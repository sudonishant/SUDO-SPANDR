"""CyberLab analysis toolbox engine for the SPANDR sandbox.

TryHackMe-style analysis toolkit that powers the in-guest CyberLab window and
the guest terminal commands (nmap / whois / dig / ping / hashid / crack / webchk).

Design rules
------------
* Real tool execution when the binary exists (nmap, tshark, john, whois, dig,
  traceroute, ping) — e.g. inside the air-gapped sandbox container where
  Dockerfile.sandbox installs the full toolset.
* Deterministic pure-Python fallbacks otherwise (TCP connect scanner, socket DNS,
  urllib page inspection, dictionary hash cracking, stdlib pcap parser) so the
  feature keeps working on bare cloud deploys without shelling out.
* Egress policy: cloud-metadata and link-local targets are ALWAYS blocked.
  Loopback / RFC1918 scanning is only allowed when CYBERLAB_ALLOW_PRIVATE=1
  (set inside the lab container). Hosted deployments stay public-only.
Missing data is never replaced with a guess — each result reports its engine.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import ipaddress
import os
import re
import shutil
import socket
import ssl
import struct
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

TOOL_BINS = {
    "nmap": "nmap",
    "whois": "whois",
    "dig": "dig",
    "traceroute": "traceroute",
    "ping": "ping",
    "tshark": "tshark",
    "john": "john",
    "binwalk": "binwalk",
    "exiftool": "exiftool",
    "whatweb": "whatweb",
    "sqlmap": "sqlmap",
    "hydra": "hydra",
    "netcat": "nc",
}

COMMON_PORTS = [
    21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 465, 587, 993,
    995, 1433, 1521, 2049, 3306, 3389, 5432, 5900, 5985, 6379, 8000, 8008,
    8080, 8081, 8443, 8888, 9200, 11211, 27017,
]

BUILTIN_WORDLIST = [
    "password", "123456", "123456789", "qwerty", "password1", "12345678",
    "111111", "1234567890", "1234567", "abc123", "password123", "admin",
    "letmein", "welcome", "monkey", "dragon", "iloveyou", "sunshine",
    "princess", "football", "charlie", "aa123456", "donald", "password12",
    "qwerty123", "admin123", "pass123", "test", "test123", "changeme",
    "master", "login", "passw0rd", "p@ssw0rd", "shadow", "superman",
    "trustno1", "hello", "secret", "security", "manager", "root", "toor",
    "pass", "summer", "winter", "spring", "autumn", "football1", "baseball",
    "hunter", "access", "flower", "ninja", "mustang", "michael", "jennifer",
    "starwars", "klaster", "112233", "george", "computer", "michelle",
    "jessica", "pepper", "123123", "654321", "1q2w3e4r", "qwertyuiop",
    "1qaz2wsx", "zaq12wsx", "ashley", "bailey", "passw0rd1", "hello123",
]

HASH_RULES = [
    (r"^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$", "bcrypt"),
    (r"^\$1\$[\./A-Za-z0-9]{1,8}\$[\./A-Za-z0-9]{22}$", "md5crypt"),
    (r"^\$5\$[\./A-Za-z0-9./]{1,16}\$[\./A-Za-z0-9./]{43}$", "sha256crypt"),
    (r"^\$6\$[\./A-Za-z0-9./]{1,16}\$[\./A-Za-z0-9./]{86}$", "sha512crypt"),
    (r"^[a-fA-F0-9]{32}$", "MD5 (or NTLM)"),
    (r"^[a-fA-F0-9]{40}$", "SHA1"),
    (r"^[a-fA-F0-9]{56}$", "SHA224"),
    (r"^[a-fA-F0-9]{64}$", "SHA256"),
    (r"^[a-fA-F0-9]{96}$", "SHA384"),
    (r"^[a-fA-F0-9]{128}$", "SHA512"),
]

FLAG_RE = re.compile(r"FLAG\{[^}]+\}")

_hostname_re = re.compile(r"^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9][A-Za-z0-9-]{0,62}$")


# ------------------------------------------------------------------ helpers
def tool_status() -> Dict[str, Any]:
    """Which analysis binaries are actually present on this host."""
    tools = {}
    for name, binary in TOOL_BINS.items():
        tools[name] = {"binary": binary, "available": shutil.which(binary) is not None}
    return {
        "guest_image": "spandr-sbx-cyberlab",
        "private_targets_allowed": os.environ.get("CYBERLAB_ALLOW_PRIVATE", "0") == "1",
        "tools": tools,
    }


def _run(cmd: List[str], timeout: int = 60) -> Tuple[int, str]:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except FileNotFoundError:
        return -1, f"{cmd[0]}: not installed on this host"
    except subprocess.TimeoutExpired:
        return -1, f"{cmd[0]}: timed out after {timeout}s"
    except Exception as exc:  # pragma: no cover - defensive
        return -1, f"{cmd[0]}: {exc}"


def _guard_target(target: str) -> Tuple[bool, str]:
    """Block cloud-metadata / link-local always; private + loopback only in the lab."""
    host = target.strip()
    if not host:
        return False, "empty target"
    host = host.split("/")[0]
    try:
        if _hostname_re.match(host):
            infos = socket.getaddrinfo(host, None)
            addrs = {info[4][0] for info in infos}
        else:
            addrs = {str(ipaddress.ip_address(host))}
    except ValueError:
        return False, f"invalid target '{target}'"
    except socket.gaierror as exc:
        return False, f"DNS resolution failed for '{target}': {exc}"

    allow_private = os.environ.get("CYBERLAB_ALLOW_PRIVATE", "0") == "1"
    for addr in addrs:
        ip = ipaddress.ip_address(addr)
        if ip.is_link_local or ip.is_multicast or ip in ipaddress.ip_network("0.0.0.0/8"):
            return False, f"{addr} is link-local/metadata space — permanently blocked"
        if not allow_private and (ip.is_loopback or ip.is_private or ip.is_reserved):
            return False, (f"{addr} is a private/loopback destination — enable "
                           "CYBERLAB_ALLOW_PRIVATE=1 inside the lab container to scan lab targets")
    return True, ""


def _parse_nmap_xml(xml: str) -> List[Dict[str, Any]]:
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(xml)
    except Exception:
        return []
    ports: List[Dict[str, Any]] = []
    for port in root.findall(".//port"):
        state = port.find("state")
        svc = port.find("service")
        ports.append({
            "port": int(port.get("portid", 0)),
            "proto": port.get("protocol", "tcp"),
            "state": state.get("state") if state is not None else "unknown",
            "service": svc.get("name") if svc is not None else "",
            "product": (svc.get("product") or "") if svc is not None else "",
            "version": (svc.get("version") or "") if svc is not None else "",
        })
    return ports


# ------------------------------------------------------------------ scanners
def port_scan(target: str, mode: str = "quick") -> Dict[str, Any]:
    """Port scan via nmap when present, else a real TCP connect scan."""
    ok, reason = _guard_target(target)
    if not ok:
        return {"error": reason, "target": target}

    if shutil.which("nmap"):
        args = {
            "quick": "-T4 --top-ports 20",
            "standard": "-sV -T4 --top-ports 100",
            "full": "-sV -T4 -p 1-2000",
        }.get(mode, "-T4 --top-ports 20")
        rc, out = _run(["nmap", *args.split(), "-oX", "-", target], timeout=180)
        xml_start = out.find("<?xml")
        ports = _parse_nmap_xml(out[xml_start:]) if xml_start >= 0 else []
        return {"target": target, "engine": f"nmap ({args})", "ports": ports,
                "open": [p for p in ports if p["state"] == "open"], "raw": out[-4000:]}

    ports_to_scan = COMMON_PORTS[:20] if mode == "quick" else (
        COMMON_PORTS if mode == "standard" else COMMON_PORTS + list(range(3000, 3100)))
    results: List[Dict[str, Any]] = []

    def probe(port: int) -> Dict[str, Any]:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.8)
        try:
            sock.connect((target, port))
            banner = ""
            try:
                sock.settimeout(0.6)
                banner = sock.recv(80).decode(errors="replace").strip()
            except Exception:
                banner = ""
            return {"port": port, "proto": "tcp", "state": "open",
                    "service": socket.getservbyport(port, "tcp") if _safe_serv(port) else "",
                    "product": banner[:80], "version": ""}
        except Exception:
            return {"port": port, "proto": "tcp", "state": "closed", "service": "", "product": "", "version": ""}
        finally:
            sock.close()

    with concurrent.futures.ThreadPoolExecutor(max_workers=64) as pool:
        results = list(pool.map(probe, ports_to_scan))
    results.sort(key=lambda p: p["port"])
    return {"target": target, "engine": "builtin tcp-connect scanner",
            "ports": results, "open": [p for p in results if p["state"] == "open"],
            "raw": f"scanned {len(ports_to_scan)} ports with builtin connect engine"}


def _safe_serv(port: int) -> bool:
    try:
        socket.getservbyport(port, "tcp")
        return True
    except Exception:
        return False


def recon(target: str, action: str) -> Dict[str, Any]:
    """whois / dig / ping / traceroute / http-headers with socket+urllib fallbacks."""
    ok, reason = _guard_target(target)
    if not ok and action != "headers":
        return {"error": reason, "target": target, "action": action}
    if action == "headers" and target.startswith("http"):
        url = target
    else:
        url = f"http://{target}"

    binaries = {"whois": ["whois", target], "dig": ["dig", "+noall", "+answer", target, "A"],
                "ping": ["ping", "-c", "4", target],
                "traceroute": ["traceroute", "-m", "15", "-w", "2", target],
                "headers": ["curl", "-sI", "-m", "15", url]}
    if action in binaries and shutil.which(binaries[action][0]):
        rc, out = _run(binaries[action], timeout=45)
        if out.strip():
            return {"target": target, "action": action,
                    "engine": f"real {binaries[action][0]}", "output": out[-8000:]}
        # empty dig/whois answer (e.g. hosts-file names) -> fall through to resolver

    # pure-python fallbacks — real answers, not guesses
    if action in ("dig", "whois", "ping", "traceroute"):
        try:
            infos = socket.getaddrinfo(target, None)
            addrs = sorted({i[4][0] for i in infos})
            lines = [f"{target}\tIN A\t{a}" for a in addrs if ":" not in a]
            lines += [f"{target}\tIN AAAA\t{a}" for a in addrs if ":" in a]
            if action == "whois":
                lines.append("(whois binary not present — DNS-resolved addresses shown)")
            return {"target": target, "action": action, "engine": "builtin resolver",
                    "resolved_ip": addrs[0] if addrs else None, "output": "\n".join(lines)}
        except socket.gaierror as exc:
            return {"target": target, "action": action, "engine": "builtin resolver",
                    "error": f"resolution failed: {exc}"}

    if action == "headers":
        try:
            req = urllib.request.Request(url, method="GET",
                                         headers={"User-Agent": "SPANDR-CyberLab/1.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                head = [f"HTTP/1.1 {resp.status} {resp.reason}"]
                head += [f"{k}: {v}" for k, v in resp.headers.items()]
                return {"target": target, "action": action, "engine": "builtin urllib",
                        "resolved_ip": socket.gethostbyname(urllib.parse.urlparse(url).hostname or target),
                        "output": "\n".join(head), "flags": FLAG_RE.findall(str(resp.headers))}
        except Exception as exc:
            return {"target": target, "action": action, "engine": "builtin urllib",
                    "error": f"request failed: {exc}"}
    return {"error": f"unknown action '{action}'", "target": target}


# ------------------------------------------------------------------ hashes
def hash_identify(hash_str: str) -> Dict[str, Any]:
    h = hash_str.strip()
    matches = [{"type": t, "pattern": p} for p, t in HASH_RULES if re.match(p, h)]
    return {"hash": h, "length": len(h), "matches": matches}


def _dict_attack(h: str, words: List[str]) -> Tuple[Optional[str], Optional[str]]:
    H = h.lower()
    algos: List[Tuple[str, Any]] = []
    if len(H) == 32:
        algos = [("md5", lambda w: hashlib.md5(w).hexdigest()),
                 ("md5(md5)", lambda w: hashlib.md5(hashlib.md5(w).hexdigest().encode()).hexdigest())]
    elif len(H) == 40:
        algos = [("sha1", lambda w: hashlib.sha1(w).hexdigest()),
                 ("sha1(sha1)", lambda w: hashlib.sha1(hashlib.sha1(w).hexdigest().encode()).hexdigest())]
    elif len(H) == 64:
        algos = [("sha256", lambda w: hashlib.sha256(w).hexdigest())]
    elif len(H) == 128:
        algos = [("sha512", lambda w: hashlib.sha512(w).hexdigest())]
    for name, fn in algos:
        for word in words:
            word = word.strip("\r")
            if word and fn(word.encode()) == H:
                return word, name
    return None, None


def hash_crack(hash_str: str, wordlist_path: Optional[str] = None) -> Dict[str, Any]:
    h = hash_str.strip()
    if not h:
        return {"error": "empty hash"}
    identify = [t for p, t in HASH_RULES if re.match(p, h)]
    words = BUILTIN_WORDLIST
    if wordlist_path and os.path.isfile(wordlist_path):
        try:
            words = open(wordlist_path, errors="ignore").read().splitlines() or words
        except Exception:
            pass

    # crypt-style -> real John the Ripper when available
    john_map = {"bcrypt": "bcrypt", "md5crypt": "md5crypt",
                "sha256crypt": "sha256crypt", "sha512crypt": "sha512crypt"}
    fmt = john_map.get(identify[0] if identify else "")
    if fmt and shutil.which("john"):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".hash", delete=False) as fh:
            fh.write(h + "\n")
            hashfile = fh.name
        try:
            _run(["john", "--wordlist=" + (wordlist_path or "/usr/share/john/password.lst"),
                  "--format=" + fmt, hashfile], timeout=90)
            rc, shown = _run(["john", "--show", "--format=" + fmt, hashfile], timeout=15)
            m = re.search(rf"{re.escape(h)}:(\S+)", shown)
            if m and m.group(1) not in ("", "?"):
                return {"hash": h, "identify": identify, "cracked": True,
                        "password": m.group(1), "engine": f"John the Ripper ({fmt})"}
        finally:
            try:
                os.unlink(hashfile)
            except Exception:
                pass

    pwd, algo = _dict_attack(h, words)
    if pwd:
        return {"hash": h, "identify": identify, "cracked": True,
                "password": pwd, "engine": f"builtin dictionary engine ({algo})"}
    return {"hash": h, "identify": identify, "cracked": False,
            "engine": "builtin dictionary engine",
            "message": f"not found after {len(words)} candidates"}


# ------------------------------------------------------------------ web
INTERESTING_PATHS = ["/robots.txt", "/sitemap.xml", "/.git/HEAD", "/.env",
                     "/admin", "/backup", "/debug", "/login", "/api/users",
                     "/server-status", "/phpinfo.php", "/config.php"]
SEC_HEADERS = ["strict-transport-security", "content-security-policy",
               "x-frame-options", "x-content-type-options", "referrer-policy"]


def web_analyze(url: str, deep: bool = False) -> Dict[str, Any]:
    """Static + HTTP inspection of a web target (urllib; no browser execution)."""
    url = url.strip()
    if not re.match(r"^https?://", url):
        url = "http://" + url
    parsed = urllib.parse.urlparse(url)
    ok, reason = _guard_target(parsed.hostname or "")
    if not ok:
        return {"error": reason, "url": url}

    result: Dict[str, Any] = {"url": url, "engine": "builtin web analyzer",
                              "checks": [], "forms": [], "comments": [],
                              "paths": [], "flags": []}

    def fetch(u: str) -> Tuple[int, Dict[str, str], str]:
        req = urllib.request.Request(u, headers={"User-Agent": "SPANDR-CyberLab/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read(200_000).decode(errors="replace")
            return resp.status, dict(resp.headers), body

    try:
        status, headers, body = fetch(url)
    except Exception as exc:
        return {"error": f"connection failed: {exc}", "url": url}

    lower = {k.lower(): v for k, v in headers.items()}
    result["status"] = status
    result["headers"] = headers
    result["flags"] = FLAG_RE.findall(body) + FLAG_RE.findall(str(headers))

    def check(name: str, ok_: bool, detail: str, sev: str = "info") -> None:
        result["checks"].append({"name": name, "ok": ok_, "detail": detail, "severity": sev})

    check("Server banner", True,
          lower.get("server", lower.get("x-powered-by", "not disclosed")), "low")
    missing = [h for h in SEC_HEADERS if h not in lower]
    check("Security headers", not missing,
          "missing: " + ", ".join(missing) if missing else "all present",
          "medium" if len(missing) > 3 else "low")
    if "set-cookie" in lower:
        ck = lower["set-cookie"]
        flagsl = [f for f in ("HttpOnly", "Secure", "SameSite") if f.lower() not in ck.lower()]
        check("Cookie flags", not flagsl, f"missing: {', '.join(flagsl)}" if flagsl else ck, "low")

    result["comments"] = [c.strip()[:200] for c in re.findall(r"<!--(.*?)-->", body, re.S)][:15]
    for fm in re.finditer(r"<form([^>]*)>(.*?)</form>", body, re.S | re.I):
        attrs, inner = fm.group(1), fm.group(2)
        am = re.search(r"action=[\"']([^\"']*)[\"']", attrs)
        mm = re.search(r"method=[\"']([^\"']*)[\"']", attrs, re.I)
        result["forms"].append({
            "action": am.group(1) if am else "",
            "method": mm.group(1).upper() if mm else "GET",
            "fields": re.findall(r"<input[^>]*name=[\"']([^\"']+)[\"']", inner, re.I),
        })

    paths = INTERESTING_PATHS if deep else INTERESTING_PATHS[:6]
    base = url.rstrip("/")
    for path in paths:
        try:
            st, ph, pb = fetch(base + path)
            if st != 404:
                result["paths"].append({"path": path, "status": st, "size": len(pb),
                                        "flags": FLAG_RE.findall(pb[:50_000])})
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                result["paths"].append({"path": path, "status": exc.code, "size": 0, "flags": []})
        except Exception:
            continue

    if shutil.which("whatweb"):
        rc, ww = _run(["whatweb", "--color=never", "-a", "3", url], timeout=45)
        result["whatweb"] = ww[:4000]
    return result


# ------------------------------------------------------------------ pcap
def pcap_analyze(data: bytes, filename: str = "capture.pcap") -> Dict[str, Any]:
    """tshark when available; else a stdlib pcap parser (IP/DNS/HTTP/ICMP + flags)."""
    result: Dict[str, Any] = {"name": filename, "size": len(data), "flags": sorted(set(FLAG_RE.findall(data.decode("latin-1", "ignore"))))}

    if shutil.which("tshark"):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as fh:
            fh.write(data)
            path = fh.name
        try:
            def tw(args: str, n: int = 80) -> str:
                rc, out = _run(["tshark", "-r", path] + args.split(), timeout=60)
                return "\n".join(out.splitlines()[:n])

            result["engine"] = "tshark"
            result["protocols"] = tw("-q -z io,phs", 60)
            result["conversations"] = tw("-q -z conv,ip", 40)
            result["dns"] = tw("-Y dns -T fields -e ip.src -e ip.dst -e dns.qry.name -E separator=|", 60)
            result["http"] = tw("-Y http -T fields -e ip.src -e ip.dst -e http.request.method -e http.host -e http.request.uri -E separator=|", 60)
            result["credentials"] = tw("-Y http.request.method==POST -T fields -e ip.src -e http.host -e urlencoded-form.key -e urlencoded-form.value -E separator=|", 40)
            return result
        finally:
            try:
                os.unlink(path)
            except Exception:
                pass

    # ---- pure-python pcap parser ----
    result["engine"] = "builtin pcap parser"
    if len(data) < 24:
        result["error"] = "file too small to be a pcap"
        return result
    magic = data[:4]
    if magic == b"\xd4\xc3\xb2\xa1" or magic == b"\x4d\x3c\xb2\xa1":
        endian = "<"
    elif magic == b"\xa1\xb2\xc3\xd4" or magic == b"\xa1\xb2\x3c\x4d":
        endian = ">"
    else:
        result["error"] = f"unrecognised pcap magic {magic.hex()} (pcapng/pcap?)"
        return result

    dns, http, conversations, packets = [], [], {}, []
    offset = 24
    idx = 0
    while offset + 16 <= len(data) and idx < 2000:
        ts_sec, ts_usec, incl_len, orig_len = struct.unpack(f"{endian}IIII", data[offset:offset + 16])
        offset += 16
        frame = data[offset:offset + incl_len]
        offset += incl_len
        idx += 1
        if len(frame) < 34:
            continue
        # ethernet -> ipv4
        ethertype = struct.unpack("!H", frame[12:14])[0]
        ip_off = 14
        if ethertype != 0x0800 and len(frame) > 34:
            continue
        iph = frame[ip_off:]
        if len(iph) < 20 or (iph[0] >> 4) != 4:
            continue
        ihl = (iph[0] & 0x0F) * 4
        proto = iph[9]
        src = ".".join(str(b) for b in iph[12:16])
        dst = ".".join(str(b) for b in iph[16:20])
        conversations[(src, dst)] = conversations.get((src, dst), 0) + 1
        segment = iph[ihl:]
        if proto == 17 and len(segment) >= 8:  # UDP
            sport, dport, ulen = struct.unpack("!HHH", segment[:6])
            payload = segment[8:]
            if dport == 53 or sport == 53:
                qname = _dns_qname(payload)
                if qname:
                    dns.append({"src": src, "dst": dst, "query": qname})
        elif proto == 6 and len(segment) >= 20:  # TCP
            doff = ((segment[12] >> 4) & 0x0F) * 4
            payload = segment[doff:]
            if payload:
                text = payload.decode("latin-1", "ignore")
                m = re.match(r"(GET|POST|PUT|DELETE|HEAD)\s+(\S+)\s+HTTP", text)
                host = re.search(r"Host:\s*([^\r\n]+)", text)
                if m:
                    http.append({"src": src, "dst": dst, "method": m.group(1),
                                 "uri": m.group(2)[:120],
                                 "host": host.group(1).strip() if host else ""})
                creds = re.findall(r"(username|user|login|password|pass|pwd)=([^&\s\r\n]+)", text)
                if creds:
                    http.append({"src": src, "dst": dst, "method": "POST-DATA",
                                 "uri": " ".join(f"{k}={v}" for k, v in creds),
                                 "host": host.group(1).strip() if host else ""})
        elif proto == 1:
            packets.append(f"ICMP {src} -> {dst}")

    result["dns"] = "\n".join(f"{d['src']} -> {d['dst']}  {d['query']}" for d in dns[:60])
    result["http"] = "\n".join(f"{h['src']} -> {h['dst']} {h['method']} http://{h['host']}{h['uri']}"
                               for h in http[:60])
    result["credentials"] = "\n".join(h["uri"] for h in http if h["method"] == "POST-DATA") or ""
    result["conversations"] = "\n".join(f"{s} -> {d}  {c} packets"
                                        for (s, d), c in sorted(conversations.items(), key=lambda kv: -kv[1])[:40])
    result["protocols"] = f"parsed {idx} frames · {len(dns)} DNS · {len(http)} HTTP · {len(packets)} ICMP"
    return result


def _dns_qname(payload: bytes) -> str:
    try:
        if len(payload) < 13:
            return ""
        i = 12
        labels = []
        while i < len(payload):
            length = payload[i]
            if length == 0:
                break
            if length & 0xC0:
                break
            labels.append(payload[i + 1:i + 1 + length].decode("latin-1", "ignore"))
            i += 1 + length
        return ".".join(labels)
    except Exception:
        return ""


# =============================================================================
# EMAIL THREAT LAB — real-PC style attachment & link analysis with automation
# =============================================================================
# Static evidence only: nothing is executed. Findings are observations with
# explicit uncertainty, consistent with the SentinelMail doctrine.

import base64
import email
import email.policy
import zipfile
from io import BytesIO

SUSPICIOUS_STRINGS = [
    "powershell", "cmd.exe", "wscript.shell", "createobject", "autoopen",
    "document_open", "workbook_open", "shell(", "urldownloadtofile",
    "virtualalloc", "createremotethread", "base64 -decode", "frombase64string",
    "hidden", "-enc", "invoke-expression", "iex(", "certutil", "bitsadmin",
    "mshta", "regsvr32", "rundll32", "schtasks",
]

SUSPICIOUS_TLDS = {"tk", "ml", "ga", "cf", "gq", "xyz", "top", "icu", "click",
                   "link", "live", "online", "site", "club", "work", "buzz",
                   "rest", "icu", "cam", "monster"}

BRAND_KEYWORDS = ["paypal", "apple", "microsoft", "google", "amazon", "netflix",
                  "bank", "hdfc", "sbi", "icici", "paytm", "phonepe", "gpay",
                  "whatsapp", "instagram", "facebook", "linkedin", "dropbox",
                  "outlook", "office365", "onedrive", "dhl", "fedex", "irctc"]

RISKY_ARCHIVE_MEMBERS = re.compile(
    r"\.(exe|scr|bat|cmd|js|vbs|ps1|hta|jar|apk|dll|lnk|iso|img|docm|xlsm|pptm)\s*$",
    re.I)


def _verdict(score: int) -> str:
    if score >= 70:
        return "LIKELY MALICIOUS — treat as hostile evidence"
    if score >= 40:
        return "SUSPICIOUS — manual analyst review required"
    if score >= 20:
        return "LOW-SUSPICION — note the observations before releasing"
    return "NO STATIC MARKERS — not a verdict of safety"


def _iocs_from_text(text: str) -> Dict[str, List[str]]:
    urls = re.findall(r"https?://[^\s\"'<>\\)]+", text, re.I)
    emails_found = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    ips = re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)
    return {
        "urls": list(dict.fromkeys(u.rstrip(".,;") for u in urls))[:40],
        "emails": list(dict.fromkeys(emails_found))[:20],
        "ips": list(dict.fromkeys(ips))[:20],
    }


def attachment_lab(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Deep static analysis of one email attachment (real PC toolbox)."""
    data = bytes(file_bytes or b"")
    name = filename or "attachment.bin"
    findings: List[str] = []
    score = 0

    # layer 1 — existing SentinelMail carver (magic, entropy, boundary anomalies)
    base_report: Dict[str, Any] = {}
    try:
        from app.core.attachment_carver import disassemble_attachment
        base_report = disassemble_attachment(name, data)
        score += int(base_report.get("risk_score") or 0)
        findings.extend(base_report.get("findings") or [])
    except Exception:
        try:
            from backend.app.core.attachment_carver import disassemble_attachment
            base_report = disassemble_attachment(name, data)
            score += int(base_report.get("risk_score") or 0)
            findings.extend(base_report.get("findings") or [])
        except Exception:
            findings.append("base carver unavailable — deep-layer analysis only")

    head = data[:16]
    report: Dict[str, Any] = {
        "filename": name,
        "size_bytes": len(data),
        "md5": hashlib.md5(data).hexdigest(),
        "sha1": hashlib.sha1(data).hexdigest(),
        "sha256": hashlib.sha256(data).hexdigest(),
        "magic_hex": head.hex(" ")[:48],
        "carver": base_report,
    }

    # layer 2 — printable strings / IOC sweep
    text = re.sub(rb"[^\x20-\x7e\n]", b".", data[:2_000_000]).decode("ascii", "ignore")
    low = text.lower()
    hits = [s for s in SUSPICIOUS_STRINGS if s in low]
    if hits:
        findings.append(f"suspicious script/API strings present: {', '.join(hits[:10])}")
        score += min(35, 8 * len(hits))
    iocs = _iocs_from_text(text)
    if iocs["urls"]:
        findings.append(f"{len(iocs['urls'])} URL(s) embedded in the file")
        score += 10
    report["iocs"] = iocs
    report["suspicious_strings"] = hits

    # layer 3 — format-specific deep dives
    fmt: Dict[str, Any] = {}
    if head.startswith(b"MZ"):
        fmt["type"] = "PE executable"
        findings.append("file is a Windows PE executable — detonate in the VM before any trust decision")
        score += 25 if not base_report else 10
        pe_strings = [s for s in ("This program cannot", "VirtualAlloc", "LoadLibrary",
                                  "GetProcAddress", "Wininet", "Urlmon", "CreateProcess") if s.encode() in data]
        fmt["pe_indicators"] = pe_strings
        if "VirtualAlloc" in pe_strings or "Urlmon" in pe_strings:
            findings.append("PE imports/strings suggest process injection or download behaviour")
            score += 15
    elif head.startswith(b"\xd0\xcf\x11\xe0"):
        fmt["type"] = "OLE compound (legacy Office)"
        markers = [m for m in ("VBA", "Macros", "AutoOpen", "Document_Open", "ThisDocument") if m.encode() in data]
        fmt["macro_markers"] = markers
        if markers:
            findings.append(f"legacy Office container carries macro markers: {', '.join(markers[:6])}")
            score += 25
    elif head.startswith(b"PK"):
        fmt["type"] = "ZIP container"
        try:
            with zipfile.ZipFile(BytesIO(data)) as zf:
                members = zf.namelist()
                fmt["members"] = members[:40]
                risky = [m for m in members if RISKY_ARCHIVE_MEMBERS.search(m)]
                fmt["risky_members"] = risky
                if any(m.lower().endswith("vbaproject.bin") for m in members):
                    findings.append("OOXML container embeds vbaProject.bin (macro payload)")
                    score += 30
                if risky:
                    findings.append(f"archive contains risky members: {', '.join(risky[:6])}")
                    score += 25
                # nested bomb heuristic
                if len(members) > 200:
                    findings.append("archive has an unusually large member count (possible zip bomb)")
                    score += 15
        except zipfile.BadZipFile:
            findings.append("PK magic but the ZIP structure is corrupt — possible polyglot/obfuscation")
            score += 20
    elif head.startswith(b"%PDF"):
        fmt["type"] = "PDF"
        for marker in ("/JavaScript", "/JS", "/OpenAction", "/Launch", "/EmbeddedFile", "/AA"):
            count = data.count(marker.encode())
            if count:
                fmt[marker] = count
        active = sum(fmt.get(m, 0) for m in ("/JavaScript", "/JS", "/OpenAction", "/Launch", "/AA"))
        if active:
            findings.append(f"PDF contains {active} active-content markers (JS/OpenAction/Launch)")
            score += min(40, 12 * active)
    elif head.startswith(b"\x1f\x8b"):
        fmt["type"] = "gzip stream"
    elif head.startswith(b"Rar!"):
        fmt["type"] = "RAR archive"
        score += 10
    fmt["type"] = fmt.get("type") or (base_report.get("detected_type") if base_report else "unknown / generic bytes")
    report["format"] = fmt

    # layer 4 — external real tools when present (real PC toolbox)
    tools: Dict[str, str] = {}
    with tempfile.NamedTemporaryFile(delete=False) as fh:
        fh.write(data)
        tmp = fh.name
    try:
        if shutil.which("file"):
            rc, out = _run(["file", "-k", tmp], timeout=20)
            tools["file"] = out.strip()[:400]
        if shutil.which("exiftool"):
            rc, out = _run(["exiftool", tmp], timeout=30)
            tools["exiftool"] = out.strip()[:1500]
        if shutil.which("binwalk"):
            rc, out = _run(["binwalk", tmp], timeout=60)
            tools["binwalk"] = out.strip()[:1500]
    finally:
        try:
            os.unlink(tmp)
        except Exception:
            pass
    report["tools"] = tools

    if not findings:
        findings.append("no static malice markers observed — this is not a safety guarantee")
    report["findings"] = findings
    report["risk_score"] = min(100, score)
    report["verdict"] = _verdict(report["risk_score"])
    report["disclaimer"] = ("Static inspection only — the file was never executed. "
                            "Strings and markers are evidence, not proof of maliciousness.")
    return report


def url_lab(raw_url: str) -> Dict[str, Any]:
    """Deep static + network analysis of one suspicious link."""
    url = (raw_url or "").strip()
    if not re.match(r"^https?://", url):
        url = "http://" + url
    parsed = urllib.parse.urlparse(url)
    findings: List[str] = []
    score = 0
    report: Dict[str, Any] = {"url": url, "host": parsed.hostname or ""}

    # layer 1 — link-structure heuristics (leetsquat, punycode, cloaking)
    host = parsed.hostname or ""
    signals: List[str] = []
    if re.match(r"^\d{1,3}(\.\d{1,3}){3}$", host):
        signals.append("host is a raw IP address")
        score += 25
    if host.startswith("xn--"):
        signals.append("punycode/IDN host (possible homoglyph spoof)")
        score += 30
    if "@" in url:
        signals.append("URL contains @ (credential/cloaking trick)")
        score += 30
    if parsed.port and parsed.port not in (80, 443):
        signals.append(f"non-standard port {parsed.port}")
        score += 15
    labels = host.split(".")
    if len(labels) >= 4:
        signals.append(f"{len(labels)}-label deep subdomain chain")
        score += 15
    tld = labels[-1].lower() if labels else ""
    if tld in SUSPICIOUS_TLDS:
        signals.append(f"budget/abuse-prone TLD .{tld}")
        score += 15
    brand_hit = next((b for b in BRAND_KEYWORDS if b in host.lower()), None)
    if brand_hit and brand_hit not in host.lower().split(".")[0:1] and host.lower().split(".")[0] != brand_hit:
        if re.search(r"[0-9]", labels[0] if labels else "") or (labels and labels[0] != brand_hit):
            if labels and labels[0] != brand_hit and brand_hit in labels[0]:
                signals.append(f"brand keyword '{brand_hit}' inside a look-alike hostname (typosquat)")
                score += 30
    if re.search(r"(login|verify|secure|update|account|signin|webscr|confirm)", url, re.I):
        signals.append("credential-phishing style path keywords")
        score += 15
    if len(url) > 120:
        signals.append("unusually long URL")
        score += 10
    if parsed.scheme == "http":
        signals.append("cleartext HTTP (no TLS)")
        score += 10
    report["structure_signals"] = signals
    findings.extend(signals)

    # layer 2 — DNS
    try:
        infos = socket.getaddrinfo(host, None)
        addrs = sorted({i[4][0] for i in infos})
        report["resolved_ips"] = addrs
    except Exception as exc:
        report["resolved_ips"] = []
        findings.append(f"DNS resolution failed: {exc}")
        score += 10
        addrs = []

    # layer 3 — HTTP redirect chain + page sniff (the "open it safely" part)
    chain: List[Dict[str, Any]] = []
    body = ""
    final_headers: Dict[str, str] = {}
    try:
        current = url
        for hop in range(6):
            req = urllib.request.Request(current, headers={
                "User-Agent": "Mozilla/5.0 (SPANDR Threat Lab — static inspection)"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                hop_info = {"url": current, "status": resp.status,
                            "location": resp.headers.get("Location", "")}
                chain.append(hop_info)
                final_headers = dict(resp.headers)
                body = resp.read(200_000).decode(errors="replace")
                break
    except urllib.error.HTTPError as exc:
        chain.append({"url": url, "status": exc.code, "location": exc.headers.get("Location", "")})
        findings.append(f"HTTP error {exc.code} during fetch")
    except Exception as exc:
        findings.append(f"fetch failed (target may be down or blocking): {exc}")

    if len(chain) > 1:
        findings.append(f"redirect chain hops through {len(chain)} URLs (possible cloaking)")
        score += 15
    if chain and chain[-1].get("location"):
        pass
    # redirect loop detection needs manual follow — handle simple case:
    report["redirect_chain"] = chain
    lower_h = {k.lower(): v for k, v in final_headers.items()}
    report["headers"] = final_headers
    if "set-cookie" in lower_h:
        ck = lower_h["set-cookie"].lower()
        if "httponly" not in ck or "secure" not in ck:
            findings.append("session cookie missing HttpOnly/Secure flags")
            score += 10

    # layer 4 — page content sniff
    body_low = body.lower()
    sniff: Dict[str, Any] = {}
    if re.search(r"<input[^>]+type=[\"']password", body_low):
        sniff["password_field"] = True
        findings.append("page contains a password input field")
        score += 20
    title = re.search(r"<title>(.*?)</title>", body, re.S | re.I)
    sniff["title"] = title.group(1).strip()[:120] if title else ""
    if brand_hit and brand_hit in body_low and brand_hit not in host.lower():
        findings.append(f"page content references '{brand_hit}' but is not hosted on that brand domain")
        score += 25
    for marker in ("eval(", "unescape(", "document.write(", "atob(", "<iframe"):
        if marker in body_low:
            sniff.setdefault("obfuscation", []).append(marker)
    if sniff.get("obfuscation"):
        findings.append(f"obfuscation/embedded-frame markers: {', '.join(sniff['obfuscation'])}")
        score += 15
    if re.search(r"meta[^>]+refresh", body_low):
        sniff["meta_refresh"] = True
        findings.append("meta-refresh redirect present")
        score += 10
    report["page"] = sniff

    # layer 5 — TLS certificate (real openssl when present)
    if parsed.scheme == "https" and host and shutil.which("openssl"):
        rc, out = _run(["openssl", "s_client", "-connect", f"{host}:443", "-servername", host],
                       timeout=10)
        # s_client needs stdin close — use a different path:
        try:
            cert_pem = ssl.get_server_certificate((host, 443), timeout=8)
            with tempfile.NamedTemporaryFile("w", delete=False) as fh:
                fh.write(cert_pem)
                cpath = fh.name
            rc, cout = _run(["openssl", "x509", "-in", cpath, "-noout", "-subject", "-issuer", "-dates"], timeout=10)
            os.unlink(cpath)
            report["tls_cert"] = cout.strip()[:800]
        except Exception as exc:
            report["tls_cert"] = f"certificate fetch failed: {exc}"

    report["findings"] = findings or ["no structural phishing markers observed — not a safety guarantee"]
    report["risk_score"] = min(100, score)
    report["verdict"] = _verdict(report["risk_score"])
    report["disclaimer"] = ("Link inspected from the analysis host, not the analyst's browser. "
                            "Static + fetched-page evidence only.")
    return report


def auto_triage(eml_bytes: Optional[bytes] = None, files: Optional[List[Tuple[str, bytes]]] = None,
                urls: Optional[List[str]] = None) -> Dict[str, Any]:
    """One-click automated pipeline: email -> attachments + links -> full report."""
    attachments: List[Tuple[str, bytes]] = list(files or [])
    link_list: List[str] = list(urls or [])
    meta: Dict[str, Any] = {"attachments_found": 0, "links_found": 0}

    if eml_bytes:
        try:
            msg = email.message_from_bytes(eml_bytes, policy=email.policy.default)
            meta["subject"] = str(msg.get("Subject", ""))
            meta["from"] = str(msg.get("From", ""))
            meta["to"] = str(msg.get("To", ""))
            meta["date"] = str(msg.get("Date", ""))
            for part in msg.walk():
                fn = part.get_filename()
                if fn:
                    payload = part.get_payload(decode=True) or b""
                    attachments.append((fn, payload))
            body_text = ""
            for part in msg.walk():
                if part.get_content_type() in ("text/plain", "text/html"):
                    try:
                        body_text += part.get_content() + "\n"
                    except Exception:
                        try:
                            body_text += (part.get_payload(decode=True) or b"").decode(errors="replace") + "\n"
                        except Exception:
                            pass
            for u in re.findall(r"https?://[^\s\"'<>\\)]+", body_text, re.I):
                u = u.rstrip(".,;)]}")
                if u not in link_list:
                    link_list.append(u)
        except Exception as exc:
            meta["eml_error"] = f"EML parse failed: {exc}"

    meta["attachments_found"] = len(attachments)
    meta["links_found"] = len(link_list)

    attachment_reports = [attachment_lab(data, name) for name, data in attachments[:12]]
    url_reports = [url_lab(u) for u in link_list[:20]]

    # aggregate — worst evidence drives the verdict
    scores = [r["risk_score"] for r in attachment_reports + url_reports]
    worst = max(scores) if scores else 0
    weighted = round(sum(scores) / len(scores) * 0.4 + worst * 0.6) if scores else 0
    total_findings = []
    for r in attachment_reports:
        total_findings.append(f"[attachment] {r['filename']} · risk {r['risk_score']}/100 · {r['verdict']}")
    for r in url_reports:
        total_findings.append(f"[link] {r['url']} · risk {r['risk_score']}/100 · {r['verdict']}")

    actions: List[str] = []
    if any(r["risk_score"] >= 70 for r in attachment_reports):
        actions.append("quarantine the high-risk attachment and detonate it inside the air-gapped VM")
    if any(r.get("format", {}).get("macro_markers") for r in attachment_reports):
        actions.append("macro-enabled document: open only with macros disabled or in the VM")
    if any(r["risk_score"] >= 70 for r in url_reports):
        actions.append("do not open the high-risk link on a corporate host; inspect via Render Snapshot")
    if any(r.get("page", {}).get("password_field") for r in url_reports):
        actions.append("credential-harvesting page: submit nothing; preserve for takedown")
    if not actions:
        actions.append("no automatic containment triggered — apply standard caution")

    return {
        "pipeline": "email threat lab · auto triage",
        "meta": meta,
        "attachments": attachment_reports,
        "links": url_reports,
        "aggregate_risk": min(100, weighted),
        "verdict": _verdict(weighted),
        "summary": total_findings or ["nothing to analyse — provide an .eml, files, or URLs"],
        "recommended_actions": actions,
        "disclaimer": ("Fully automated static triage. Nothing was executed; no verdict here is "
                       "a legal or reputational conclusion. Missing data is never guessed."),
    }
