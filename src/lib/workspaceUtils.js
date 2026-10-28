export function riskTone(score = 0) {
  const value = Number(score) || 0;
  if (value >= 70) return 'high';
  if (value >= 35) return 'medium';
  return 'low';
}

export function riskLabel(data) {
  const score = Number(data?.threat?.risk_score) || 0;
  if (score >= 70) return 'High risk';
  if (score >= 35) return 'Review required';
  return 'No high-risk signals';
}

export function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value, includeTime = true) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

export function downloadCase(data) {
  if (!data) return;
  downloadJson(data, `${data.case_id || 'spandr-case'}.json`);
}

export function downloadCaseArchive(cases) {
  if (!cases?.length) return;
  const date = new Date().toISOString().slice(0, 10);
  downloadJson({
    archive_type: 'SUDO_SPANDR_DEVICE_CASE_ARCHIVE',
    version: 1,
    exported_at: new Date().toISOString(),
    case_count: cases.length,
    cases,
  }, `spandr-device-cases-${date}.json`);
}
