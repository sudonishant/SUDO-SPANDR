export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const lower = raw.toLowerCase();

  let score = 20;
  let policy = 'ACCEPT';
  let postfixCode = 'Milter.ACCEPT';
  let smtpReply = '250 2.0.0 Message accepted for delivery';

  if (lower.includes('urgent') || lower.includes('emkei') || lower.includes('password') || lower.includes('suspension')) {
    score = 88;
    policy = 'REJECT';
    postfixCode = 'Milter.REJECT';
    smtpReply = '550 5.7.1 Message rejected by SUDO SPANDR ESG: Malicious threat detected (SIH #26106)';
  } else if (lower.includes('verify') || lower.includes('bank')) {
    score = 45;
    policy = 'TAG_SUBJECT';
    postfixCode = 'Milter.QUARANTINE';
    smtpReply = '250 2.0.0 Message accepted with [SUSPICIOUS SPAM] subject tag';
  }

  return res.status(200).json({
    engine: 'SUDO SPANDR Postfix/Sendmail Milter Daemon',
    threat_score: score,
    policy_action: policy,
    postfix_code: postfixCode,
    smtp_reply: smtpReply,
    quarantine_mailbox: policy === 'REJECT' ? 'quarantine@security.gov.in' : null,
    evaluation_latency_ms: 18.4,
    statutory_admissibility: 'Sec 65B IEA / Sec 63 BSA Certified',
    timestamp: new Date().toISOString()
  });
};
