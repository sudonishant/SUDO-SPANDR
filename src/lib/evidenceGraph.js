const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function text(value, maximum = 255) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, maximum);
}

function emailAddress(value) {
  return String(value ?? '').match(EMAIL_PATTERN)?.[0]?.toLowerCase() || null;
}

function sanitizedHttpUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return null;
    // Credentials, query values and fragments can contain secrets or personal
    // data. Remove them before anything leaves the browser.
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Build the complete outbound graph payload. Keep this allowlist explicit:
 * subject, body, raw headers, raw EML/MSG bytes, attachment bytes, geolocation,
 * REA output and AI content are deliberately not copied from the analysis.
 */
export function buildEvidenceGraphProjection(data) {
  if (!data?.case_id || !/^[a-f0-9]{64}$/i.test(data?.evidence?.sha256 || '')) {
    throw new Error('A case ID and evidence SHA-256 are required before graph projection.');
  }
  const mode = ['eml', 'msg', 'text', 'text-headers', 'attachment'].includes(data.mode) ? data.mode : 'eml';
  const sender = emailAddress(data.parsed?.sender);
  const recipient = emailAddress(data.parsed?.recipient);
  const ips = [];
  const ipKeys = new Set();
  for (const item of data.relay_info?.ips || []) {
    const ip = text(item?.ip, 128);
    const field = text(item?.field || 'Submitted header', 80) || 'Submitted header';
    const key = `${ip}\0${field}`;
    if (!ip || ipKeys.has(key)) continue;
    ipKeys.add(key);
    ips.push({ ip, field });
    if (ips.length === 20) break;
  }

  const urls = [];
  const urlKeys = new Set();
  for (const item of data.aitm_analysis || []) {
    const url = sanitizedHttpUrl(item?.url);
    if (!url || urlKeys.has(url)) continue;
    urlKeys.add(url);
    urls.push({
      url,
      risk: text(item?.risk || 'UNASSESSED', 32) || 'UNASSESSED',
      kind: text(item?.kind || 'actionable link', 80) || 'actionable link',
    });
    if (urls.length === 20) break;
  }

  const attachments = (data.attachment_analysis || []).slice(0, 20).map((item) => ({
    filename: text(item?.filename || 'unnamed', 255) || 'unnamed',
    ...( /^[a-f0-9]{64}$/i.test(item?.sha256 || '') ? { sha256: item.sha256.toLowerCase() } : {}),
    size_bytes: Number.isFinite(Number(item?.size_bytes)) ? Math.max(0, Math.trunc(Number(item.size_bytes))) : 0,
    detected_type: text(item?.detected_type || 'Unknown', 120) || 'Unknown',
    risk_level: text(item?.risk_level || 'UNASSESSED', 32) || 'UNASSESSED',
  }));

  const alignmentRows = data.dns_auth?.alignment?.rows || [];
  const reportedAuth = (data.dns_auth?.results || []).slice(0, 40).map((item, index) => {
    const alignment = alignmentRows[index] || {};
    return {
      method: text(item?.method, 16).toLowerCase(),
      result: text(item?.result, 24).toLowerCase(),
      identity_domain: text(alignment?.identity_domain, 253).toLowerCase() || null,
      aligned: typeof alignment?.aligned === 'boolean' ? alignment.aligned : null,
      authserv_id: text(item?.authserv_id || 'Not reported', 255) || 'Not reported',
      header_name: text(item?.header_name || 'Submitted authentication header', 80) || 'Submitted authentication header',
      header_index: Number.isInteger(item?.header_index) ? item.header_index : index,
    };
  }).filter((item) => ['spf', 'dkim', 'dmarc', 'arc'].includes(item.method) && item.result);

  return {
    case_id: text(data.case_id, 20).toUpperCase(),
    evidence_sha256: data.evidence.sha256.toLowerCase(),
    source_mode: mode,
    triage_score: Math.min(100, Math.max(0, Math.trunc(Number(data.threat?.risk_score) || 0))),
    category_id: text(data.category_analysis?.category_id || 'unknown', 80) || 'unknown',
    category_label: text(data.category_analysis?.category_label || 'Unknown / insufficient evidence', 160) || 'Unknown / insufficient evidence',
    sender,
    recipient,
    ips,
    urls,
    attachments,
    reported_auth: reportedAuth,
  };
}
