# backend/app/core/geo_engine.py
# Real RFC-Aware Geolocation & Tor/VPN Intelligence Engine
# Compliant with ISO/IEC 27037: Network-level context without prejudicial country scoring.

import ipaddress
import functools
import os
from typing import Dict, Any, Optional

_GEO_DB = os.getenv("GEOLITE2_CITY_DB", "data/GeoLite2-City.mmdb")
_ASN_DB = os.getenv("GEOLITE2_ASN_DB", "data/GeoLite2-ASN.mmdb")

# Known public Tor exit node IPs snapshot
KNOWN_TOR_EXIT_IPS = {
    "185.220.101.4", "185.220.101.5", "185.220.101.6", "185.220.101.7", "185.220.101.8",
    "185.220.102.240", "185.220.102.241", "185.220.103.4", "185.220.103.5",
    "195.181.161.205", "195.181.161.206", "51.15.43.205", "185.244.25.188"
}

# Known public spoofing relay nodes (e.g. Emkei.cz)
KNOWN_SPOOFING_RELAY_IPS = {
    "101.99.94.155", "101.99.94.156", "101.99.94.157", "195.181.161.205"
}

# RFC 5737 Documentation Ranges (TEST-NET-1, TEST-NET-2, TEST-NET-3)
DOC_NETWORKS = [
    ipaddress.ip_network("192.0.2.0/24"),
    ipaddress.ip_network("198.51.100.0/24"),
    ipaddress.ip_network("203.0.113.0/24"),
]


@functools.lru_cache(maxsize=1)
def _get_maxmind_readers():
    city_reader, asn_reader = None, None
    try:
        import maxminddb
        for geo_candidate in [_GEO_DB, "backend/data/GeoLite2-City.mmdb", "../data/GeoLite2-City.mmdb"]:
            if os.path.exists(geo_candidate):
                city_reader = maxminddb.open_database(geo_candidate)
                break
        for asn_candidate in [_ASN_DB, "backend/data/GeoLite2-ASN.mmdb", "../data/GeoLite2-ASN.mmdb"]:
            if os.path.exists(asn_candidate):
                asn_reader = maxminddb.open_database(asn_candidate)
                break
    except ImportError:
        pass
    return city_reader, asn_reader


def classify_ip(ip_str: str) -> Dict[str, Any]:
    """
    RFC-aware IP classification.
    Private, loopback, link-local, documentation and reserved IPs are marked as non-routable
    and NOT geolocated to avoid bogus mapping.
    When GeoLite2 mmdb is not loaded, public IPs report country/city as None rather than
    inventing Ashburn or Prague locations.
    """
    cleaned = ip_str.strip()
    try:
        ip_obj = ipaddress.ip_address(cleaned)
    except ValueError:
        return {
            "ip": cleaned,
            "status": "INVALID",
            "is_public": False,
            "country": None,
            "city": None,
            "isp": "Invalid Address Format",
            "asn": "N/A",
            "confidence": "NONE"
        }

    # Check for RFC 5737 Documentation Range
    is_doc = any(ip_obj in doc_net for doc_net in DOC_NETWORKS)
    if is_doc:
        return {
            "ip": cleaned,
            "is_public": False,
            "status": "NON_ROUTABLE",
            "country": "RFC 5737 Documentation Network (TEST-NET)",
            "country_code": "DOC",
            "city": "Documentation Range (Not a routable host)",
            "lat": None,
            "lon": None,
            "isp": "IANA Documentation / Benchmark Range",
            "asn": "AS0 (Documentation)",
            "accuracy_radius_km": 0,
            "is_vpn_tor": False,
            "threat_flag": "DOCUMENTATION / BENCHMARK FIXTURE",
            "flag": "🧪",
            "confidence": "VERIFIED (RFC 5737 documentation range — non-routable origin used in fixtures/tests)"
        }

    if ip_obj.is_loopback:
        return {
            "ip": cleaned,
            "is_public": False,
            "status": "NON_ROUTABLE",
            "country": "RFC 1122 Loopback",
            "country_code": "LOC",
            "city": "Localhost",
            "lat": None,
            "lon": None,
            "isp": "Local System Loopback",
            "asn": "AS0 (Loopback)",
            "accuracy_radius_km": 0,
            "is_vpn_tor": False,
            "threat_flag": "LOOPBACK",
            "flag": "🔄",
            "confidence": "VERIFIED (RFC 1122 Loopback - Geolocation Not Applicable)"
        }

    if ip_obj.is_private or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
        return {
            "ip": cleaned,
            "is_public": False,
            "status": "NON_ROUTABLE",
            "country": "RFC 1918 Private Subnet",
            "country_code": "LOC",
            "city": "Internal Enterprise Gateway",
            "lat": None,
            "lon": None,
            "isp": "Private Enterprise Routing",
            "asn": "AS0 (Internal)",
            "accuracy_radius_km": 0,
            "is_vpn_tor": False,
            "threat_flag": "INTERNAL ROUTING",
            "flag": "🔒",
            "confidence": "VERIFIED (RFC 1918 Private Infrastructure - Geolocation Not Applicable)"
        }

    # Public routable IP
    city_reader, asn_reader = _get_maxmind_readers()
    is_tor = cleaned in KNOWN_TOR_EXIT_IPS
    is_spoof_relay = cleaned in KNOWN_SPOOFING_RELAY_IPS

    out = {
        "ip": cleaned,
        "is_public": True,
        "status": "ROUTABLE",
        "country": None,
        "country_code": None,
        "city": None,
        "lat": None,
        "lon": None,
        "isp": None,
        "asn": None,
        "accuracy_radius_km": None,
        "is_vpn_tor": is_tor or is_spoof_relay,
        "threat_flag": "KNOWN SPOOFING RELAY" if is_spoof_relay else ("TOR EXIT NODE" if is_tor else "STANDARD TRANSIT"),
        "flag": "🧅" if is_tor else ("⚠️" if is_spoof_relay else "🌐"),
        "confidence": "UNAVAILABLE (GeoLite2-City.mmdb not loaded — refusing to invent a location)",
        "unavailable_reason": "GeoLite2 database not found. Set GEOLITE2_CITY_DB or place GeoLite2-City.mmdb in data/."
    }

    if city_reader:
        try:
            r = city_reader.get(cleaned) or {}
            c_name = (r.get("country") or {}).get("names", {}).get("en")
            if c_name:
                out["country"] = c_name
                out["country_code"] = (r.get("country") or {}).get("iso_code", "XX")
                out["city"] = ((r.get("city") or {}).get("names") or {}).get("en", "Unknown")
                loc = r.get("location") or {}
                out["lat"] = loc.get("latitude")
                out["lon"] = loc.get("longitude")
                out["accuracy_radius_km"] = loc.get("accuracy_radius", 50)
                out["confidence"] = f"MAXMIND (Network-level context, ±{out['accuracy_radius_km']}km)"
                del out["unavailable_reason"]
        except Exception:
            pass

    if asn_reader:
        try:
            a = asn_reader.get(cleaned) or {}
            asn_num = a.get("autonomous_system_number")
            asn_org = a.get("autonomous_system_organization")
            if asn_num:
                out["asn"] = f"AS{asn_num} ({asn_org})"
                out["isp"] = asn_org
        except Exception:
            pass

    return out
