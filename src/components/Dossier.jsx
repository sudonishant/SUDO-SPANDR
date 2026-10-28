import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Copy, Download, ShieldAlert, Terminal } from 'lucide-react';
import FormalDossier from './FormalDossier';

function unique(list) {
  return Array.from(new Set((list || []).filter(Boolean)));
}

/** Deterministic containment rule text built only from the evidence in the result. */
export function buildRules(kind, { ips = [], domains = [], caseId = 'CASE' }) {
  const uniqueIps = unique(ips);
  const uniqueDomains = unique(domains);
  const stamp = new Date().toISOString();
  const header = `# SUDO SPANDR containment draft · case ${caseId}\n# generated ${stamp}\n# source: values extracted from the submitted evidence only\n`;

  if (kind === 'iptables') {
    return `${header}
# ${uniqueIps.length} IP(s) from the relay chain
${uniqueIps.length ? uniqueIps.map((ip) => `iptables -I INPUT 1 -s ${ip} -j DROP -m comment --comment "SPANDR_REVIEW_${caseId}"\niptables -I OUTPUT 1 -d ${ip} -j DROP`).join('\n') : '# no public IP was extracted'}

# nftables equivalent
nft add table inet spandr_quarantine
nft add chain inet spandr_quarantine input { type filter hook input priority -100 \\; policy accept \\; }
${uniqueIps.length ? uniqueIps.map((ip) => `nft add rule inet spandr_quarantine input ip saddr ${ip} drop`).join('\n') : '# no public IP was extracted'}

# review before applying, then persist
# iptables-save > /etc/iptables/rules.v4`;
  }

  if (kind === 'cisco') {
    return `! SUDO SPANDR containment draft · case ${caseId}
! generated ${stamp}

configure terminal
object-group network SPANDR_BLOCKED_HOSTS
 description values extracted from submitted evidence
${uniqueIps.length ? uniqueIps.map((ip) => ` network-object host ${ip}`).join('\n') : ' ! no public IP was extracted'}
exit

object-group fqdn SPANDR_BLOCKED_DOMAINS
${uniqueDomains.length ? uniqueDomains.map((d) => ` fqdn ${d}`).join('\n') : ' ! no domain was extracted'}
exit

access-list OUTSIDE_IN extended deny ip object-group SPANDR_BLOCKED_HOSTS any log
access-group OUTSIDE_IN in interface outside
! review before write memory`;
  }

  if (kind === 'fortinet') {
    return `# SUDO SPANDR containment draft · case ${caseId}
# generated ${stamp}

config firewall address
${uniqueIps.length ? uniqueIps.map((ip, index) => ` edit "SPANDR_IP_${index + 1}"
  set subnet ${ip} 255.255.255.255
  set comment "extracted from case ${caseId}"
 next`).join('\n') : '# no public IP was extracted'}
end

config firewall policy
 edit 0
  set name "SPANDR_REVIEW_DROP"
  set srcintf "any"
  set dstintf "any"
  set srcaddr "all"
  set dstaddr "all"
  set action deny
  set logtraffic all
 next
end`;
  }

  if (kind === 'dns') {
    return `; SUDO SPANDR containment draft · case ${caseId}
; generated ${stamp}
; RPZ / Pi-hole sinkhole entries for extracted domains

${uniqueDomains.length ? uniqueDomains.map((d) => `; sinkhole: ${d}\n${d}    CNAME .\n*.${d}  CNAME .`).join('\n') : '; no domain was extracted'}

; /etc/hosts or Pi-hole format
${uniqueDomains.length ? uniqueDomains.map((d) => `0.0.0.0 ${d}\n0.0.0.0 www.${d}`).join('\n') : '# no domain was extracted'}`;
  }

  return `# SUDO SPANDR containment draft · case ${caseId}
# generated ${stamp}

${uniqueIps.length ? uniqueIps.map((ip, index) => `alert ip [${ip}] any -> $HOME_NET any (msg:"SPANDR review: relay/C2 candidate ${ip}"; classtype:trojan-activity; sid:1026${index}1; rev:1;)`).join('\n\n') : '# no public IP was extracted'}

${uniqueDomains.length ? uniqueDomains.map((d, index) => `alert dns $HOME_NET any -> any 53 (msg:"SPANDR review: query to ${d}"; dns.query; content:"${d}"; nocase; classtype:bad-unknown; sid:1027${index}1; rev:1;)`).join('\n\n') : '# no domain was extracted'}`;
}

const KINDS = [
  { id: 'iptables', label: 'iptables / nft' },
  { id: 'cisco', label: 'Cisco ASA' },
  { id: 'fortinet', label: 'FortiGate' },
  { id: 'dns', label: 'DNS sinkhole' },
  { id: 'snort', label: 'Suricata / Snort' },
];

export function ContainmentPanel({ ips, domains, caseId }) {
  const [kind, setKind] = useState('iptables');
  const [copied, setCopied] = useState(false);
  const rules = useMemo(() => buildRules(kind, { ips, domains, caseId }), [kind, ips, domains, caseId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rules);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([rules], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `${caseId}-${kind}-containment.txt`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="containment">
      <div className="containment__head">
        <div className="panel__head">
          <span className="panel__icon"><ShieldAlert size={14} /></span>
          <div><small>Draft only · not applied</small><h3>Containment rules</h3></div>
        </div>
        <div className="containment__actions">
          <button type="button" className="app-btn app-btn--sm" onClick={copy}>
            <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#63e08a,#18a34a)' }}>
              {copied ? <ClipboardCheck size={13} /> : <Copy size={13} />}
            </span>
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="app-btn app-btn--sm" onClick={download}>
            <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#7cc0ff,#2e7cf6)' }}><Download size={13} /></span>
            Download
          </button>
        </div>
      </div>

      <div className="tabs tabs--sm" role="tablist">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={kind === item.id}
            className={`tab ${kind === item.id ? 'active' : ''}`}
            onClick={() => setKind(item.id)}
          >
            <Terminal size={12} />{item.label}
          </button>
        ))}
      </div>

      <pre className="containment__code" tabIndex={0} role="region" aria-label="Containment rule draft">{rules}</pre>
      <p className="disclaimer">
        Generated from {unique(ips).length} IP(s) and {unique(domains).length} domain(s) present in this result.
        Review with your network owner before applying — a rule does not prove the value is malicious.
      </p>
    </div>
  );
}

export function DossierView({ data }) {
  const ips = (data.relay_info?.ips || []).map((item) => item.ip);
  const domains = (data.aitm_analysis || []).map((item) => item.domain);
  return (
    <FormalDossier data={data}>
      <ContainmentPanel ips={ips} domains={domains} caseId={data.case_id} />
    </FormalDossier>
  );
}
