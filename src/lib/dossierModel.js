export function text(value, fallback = 'Not observed') {
  if (value === 0) return '0';
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

export function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Not recorded';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB (${bytes} bytes)`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB (${bytes} bytes)`;
}

export function formatTimestamp(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value);
  return `${date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' })} IST · ${date.toISOString()}`;
}

export function riskLevel(score) {
  const value = Number(score) || 0;
  if (value >= 70) return 'HIGH';
  if (value >= 35) return 'MEDIUM';
  return 'LOW';
}

export function validCoordinates(item) {
  const latitudeValue = item?.latitude ?? item?.approximate_location?.latitude;
  const longitudeValue = item?.longitude ?? item?.approximate_location?.longitude;
  if ([latitudeValue, longitudeValue].some((value) => value === null || value === undefined || value === '')) return false;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function networkPlace(item) {
  const location = item?.approximate_location || {};
  const providerPlace = [location.city, location.region, location.country].filter(Boolean);
  if (providerPlace.length) return providerPlace.join(', ');
  // Do not mislabel a legacy RDAP registration country as geolocation.
  const legacyPlace = validCoordinates(item) ? [item?.city, item?.region, item?.country].filter(Boolean) : [];
  return legacyPlace.join(', ') || 'Approximate place not returned';
}

export function buildDossierModel(data, generatedAt = new Date().toISOString()) {
  const parsed = data?.parsed || {};
  const threat = data?.threat || {};
  const category = data?.category_analysis || {};
  const evidence = data?.evidence || {};
  const attachments = data?.attachment_analysis || [];
  const relay = data?.relay_info || null;
  const geo = data?.geo_data || {};
  const networkResults = geo.results || [];
  const hash = evidence.sha256 || parsed.sha256_hash || null;
  const score = Number(threat.risk_score) || 0;
  const mode = data?.mode || 'unknown';
  const isFile = ['eml', 'msg', 'attachment'].includes(mode);
  const findings = (threat.signals || []).map((signal) => typeof signal === 'string'
    ? { label: signal, evidence: 'Observed by the local static attachment inspector.', weight: null }
    : { label: signal.label || 'Observed signal', evidence: signal.evidence || 'No additional explanation was returned.', weight: signal.weight ?? null });

  return {
    caseId: text(data?.case_id, 'UNASSIGNED'),
    documentNumber: `SUDO-SPANDR/${text(data?.case_id, 'UNASSIGNED')}/WORKING-REPORT`,
    title: 'साइबर फोरेंसिक विश्लेषण प्रतिवेदन',
    subtitle: 'CYBER FORENSIC ANALYSIS REPORT',
    handling: 'RESTRICTED HANDLING · ANALYST WORKING COPY',
    documentStatus: 'SYSTEM GENERATED · HUMAN REVIEW PENDING',
    generatedAt,
    generatedLabel: formatTimestamp(generatedAt),
    analysisLabel: formatTimestamp(data?._workspace?.receivedAt),
    updatedLabel: formatTimestamp(data?._workspace?.updatedAt),
    score,
    risk: riskLevel(score),
    threatStatus: text(threat.status),
    threatNote: text(threat.note, 'No triage note was recorded.'),
    category,
    metadata: [
      { label: 'Case reference', value: text(data?.case_id, 'UNASSIGNED'), mono: true },
      { label: 'Source / exhibit label', value: text(data?._workspace?.sourceLabel || data?.filename || parsed?.meta?.filename), mono: true },
      { label: 'Evidence format', value: text(data?.format_type) },
      { label: 'Input mode', value: text(mode) },
      { label: 'Original filename', value: text(data?.filename || parsed?.meta?.filename, mode === 'text' || mode === 'text-headers' ? 'Not applicable — pasted content' : 'Not recorded'), mono: true },
      { label: 'Analysis received', value: formatTimestamp(data?._workspace?.receivedAt) },
      { label: 'Processing lane', value: text(data?._workspace?.processing, 'Browser analysis') },
      { label: 'From', value: text(parsed.sender) },
      { label: 'To', value: text(parsed.recipient) },
      { label: 'Subject', value: text(parsed.subject) },
    ],
    integrity: [
      { label: 'Hash algorithm', value: hash ? 'SHA-256' : 'Not available' },
      { label: 'Computed digest', value: text(hash, 'Not available'), mono: true },
      { label: 'Hash scope', value: isFile ? 'Submitted file bytes as read by the browser parser' : 'Submitted/parsed text content; not a file-acquisition hash' },
      { label: 'Submitted byte size', value: formatBytes(evidence.raw_size_bytes ?? parsed?.meta?.size_bytes) },
      { label: 'Original-byte retention', value: 'Original bytes are not embedded in this report or the saved browser case.' },
      { label: 'Parsed-case retention', value: text(evidence.preservation, 'Browser-profile storage when available; no independent preservation claim.') },
      { label: 'Acquisition custodian / device', value: 'Not recorded by this application — must be documented separately by the analyst.' },
      { label: 'Continuity verification', value: 'Recompute the digest from the preserved original and compare it independently. This report alone does not prove continuity of custody.' },
    ],
    authentication: data?.dns_auth ? {
      values: [['SPF', data.dns_auth.spf], ['DKIM', data.dns_auth.dkim], ['DMARC', data.dns_auth.dmarc], ['ARC', data.dns_auth.arc]],
      reportedHeader: text(data.dns_auth.reported_header),
      sources: data.dns_auth.evidence_sources || [],
      raw: text(data.dns_auth.raw_reported, 'No recognised authentication result header was supplied.'),
      note: text(data.dns_auth.note),
    } : null,
    relays: relay?.ips || [],
    relayStatus: text(relay?.status, mode === 'attachment' ? 'Not applicable to a standalone file' : 'Not available'),
    relayNote: text(relay?.note, 'No relay interpretation is available.'),
    networkResults,
    networkStatus: text(geo.status, 'NOT LOOKED UP'),
    networkNote: text(geo.note, 'No external network-context lookup has been performed.'),
    networkPrivacy: text(geo.privacy, 'Network lookups occur only after an explicit analyst action.'),
    mapAvailable: networkResults.some(validCoordinates),
    urls: data?.aitm_analysis || [],
    attachments,
    findings,
    scoreBreakdown: threat.score_breakdown || null,
    limitations: unique([...(data?.limitations || []), data?.parseError ? `Parser limitation: ${data.parseError}` : null]),
    rea: data?.rea_analysis || null,
    recommendations: unique([
      category.recommended_action,
      'Preserve the original evidence separately and independently verify its SHA-256 digest before relying on this working report.',
      'Review extracted IPs, domains, authentication headers, and file findings in context; do not block, delete, send, or attribute solely from this automated triage.',
      data?.rea_analysis ? 'Treat REA output as bounded static provider evidence; examine its stated unknowns and limitations before drawing conclusions.' : null,
    ]),
    legalNote: 'This is a formal analyst working layout, not a document issued by a government body, forensic laboratory, court, or certifying authority. It contains no official seal, certification, or generated signature. For Indian legal proceedings, assess applicable electronic-record requirements—including Section 63 of the Bharatiya Sakshya Adhiniyam, 2023—with qualified counsel and the relevant forensic process. No court-admissibility conclusion is made here.',
    reviewFields: [
      ['Analyst name / designation', 'Pending human review'],
      ['Organisation / unit', 'Not recorded'],
      ['Independent hash verification', 'Not performed by this report'],
      ['Review date and remarks', 'Pending human review'],
      ['Authorised signatory', 'Not signed — no signature is generated'],
    ],
  };
}
