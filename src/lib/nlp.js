/*
 * AI scoring lanes for SUDO SPANDR — Keywords, NLP, and a BERT-style
 * semantic lane (offline, deterministic distilled embeddings).
 *
 * Lanes
 *  1. Keyword lexicon — weighted category phrase matching (urgency,
 *     credential, payment diversion, impersonation, malware, data request…)
 *  2. NLP — tokenisation, stop-word removal, bigrams, style features
 *     (caps pressure, exclamations, imperative verbs) with TF weighting
 *  3. Semantic — hashed token/bigram/char-n-gram embedding (256-d) compared
 *     by cosine against phishing vs benign prototype centroids (seed corpus
 *     below). This is a distilled, offline stand-in for a transformer
 *     classifier; nothing leaves the browser.
 *
 * Intent classes follow the SIH problem statement: phishing, impersonation,
 * urgency, payment diversion, thread hijacking, data exfiltration.
 */

const STOPWORDS = new Set(('a an the and or but if then than so of to in on at by for from with without is are was were be been being have has had do does did will would can could should may might must this that these those it its you your yours we our they them he she his her as not no yes your you\'re we\'ve i\'m it\'s re fwd subject hello hi dear please thanks thank regards best'.split(' ')));

export const KEYWORD_LEXICON = {
  urgency: {
    label: 'Urgency / pressure tactics',
    words: ['urgent', 'immediately', 'asap', 'within 24 hours', '24 hours', 'final notice', 'act now', 'last warning', 'expires today', 'suspend', 'suspended', 'blocked', 'locked', 'right away', 'without delay', 'deadline', 'overdue', 'failure to', 'will be cancelled', 'permanent'],
    weight: 16,
  },
  credential: {
    label: 'Credential / account harvest',
    words: ['verify your account', 'verify your identity', 'confirm your password', 'update your account', 'login', 'log in', 'sign in', 'password', 'credential', 'otp', 'one-time', 'verification code', 'security code', 'session expired', 'reset your password', 'account will be closed', 'validate your mailbox', 'unusual activity', 'suspicious activity'],
    weight: 20,
  },
  payment: {
    label: 'Payment diversion / financial',
    words: ['wire transfer', 'bank transfer', 'rtgs', 'neft', 'imps', 'upi', 'payment redirect', 'change of bank', 'updated bank details', 'gift card', 'bitcoin', 'crypto', 'remittance', 'invoice attached', 'outstanding payment', 'refund', 'swift', 'iban', 'account balance', 'funds will be held'],
    weight: 22,
  },
  impersonation: {
    label: 'Impersonation / authority',
    words: ['ceo', 'cfo', 'managing director', 'director', 'head of', 'account security team', 'security team', 'it helpdesk', 'microsoft', 'google', 'paypal', 'bank support', 'law enforcement', 'police', 'income tax', 'legal department', 'on behalf of', 'kindly treat this as urgent', 'confidential request'],
    weight: 14,
  },
  malware: {
    label: 'Malware / payload lure',
    words: ['open the attachment', 'enable macros', 'enable content', 'view attached document', 'download the invoice', 'see attachment', 'scan to pay', 'click the link', 'run the file', 'unzip and open', 'password protected archive', 'document viewer required'],
    weight: 18,
  },
  data_request: {
    label: 'Sensitive data request',
    words: ['send me', 'share the', 'kyc', 'aadhaar', 'pan card', 'passport copy', 'salary slip', 'customer list', 'database', 'credentials file', 'login details', 'employee records', 'confidential data', 'do not tell anyone', 'keep this between us', 'keep this confidential', 'do not inform'],
    weight: 16,
  },
  prize_scam: {
    label: 'Prize / advance-fee scam',
    words: ['you have won', 'lottery', 'prize', 'claim your', 'free gift', 'congratulations', 'selected for', 'beneficiary', 'inheritance', 'million dollars', 'western union'],
    weight: 14,
  },
  thread_hijack: {
    label: 'Thread hijack / reply lure',
    words: ['re:', 'fwd:', 'as discussed', 'following up on our conversation', 'per our last email', 'the previous thread', 'attached as promised', 'continuing our thread', 'old conversation'],
    weight: 8,
  },
  benign_context: {
    label: 'Benign / routine context',
    words: ['meeting invite', 'calendar', 'agenda', 'standup', 'weekly update', 'newsletter', 'maintenance notice', 'no action required', 'for your information', 'fyi', 'minutes of the meeting', 'training session', 'office timing', 'holiday notice', 'quarterly report'],
    weight: -14,
  },
};

const INTENT_RULES = [
  { id: 'credential_phishing', label: 'Credential phishing', patterns: [/verify (your )?(account|identity|password)/i, /update (your )?(account|billing)/i, /(login|sign in|password|otp|verification code)/i], lexicon: ['credential'] },
  { id: 'impersonation', label: 'Impersonation (BEC)', patterns: [/\b(ceo|cfo|director|managing director|account security team|on behalf of)\b/i, /kindly treat this as (urgent|confidential)/i], lexicon: ['impersonation'] },
  { id: 'urgency', label: 'Urgency pressure', patterns: [/\b(within \d+ hours?|final notice|act now|expires? (today|soon)|immediately)\b/i], lexicon: ['urgency'] },
  { id: 'payment_diversion', label: 'Payment diversion', patterns: [/\b(wire transfer|bank (transfer|details)|rtgs|neft|gift card|crypto|bitcoin|change.*bank)\b/i], lexicon: ['payment'] },
  { id: 'thread_hijacking', label: 'Thread hijacking', patterns: [/^(re|fwd):\s/i, /as discussed|per our (last|previous) (email|conversation)/i], lexicon: ['thread_hijack'] },
  { id: 'data_exfiltration', label: 'Data exfiltration request', patterns: [/\b(send|share|forward) (me )?(the )?(customer|employee|kyc|database|credentials?)\b/i, /(aadhaar|pan card|passport copy|salary slip)/i], lexicon: ['data_request'] },
];

const SEED_PHISHING = [
  'urgent verify your account within 24 hours or it will be suspended click the link and confirm your password immediately',
  'dear customer we detected unusual activity update your billing details via the secure link wire transfer required today final notice',
  'hello this is account security team your otp verification code will expire login now to avoid suspension of your account',
  'ceo request wire transfer to updated bank details keep this confidential do not inform anyone process payment today urgent',
  'claim your prize send kyc documents and processing fee you have won lottery beneficiary payment refund gift card',
  'please open the attachment and enable macros to view the invoice document viewer required click the link to download',
  'following up on our conversation re the invoice attached as promised please wire the outstanding payment to new iban',
  'income tax department legal notice final warning pay penalty immediately or legal action bank transfer details attached',
  'reset your password security code login attempt from new device confirm your credential or account will be closed',
  'share the customer list and database credentials file with me keep this between us urgent project deadline',
];

const SEED_BENIGN = [
  'hi team please find the weekly update attached no action required for your information the quarterly report is on the intranet',
  'meeting invite for the project standup tomorrow agenda and calendar link attached see you at the training session',
  'hello this is the monthly maintenance notice servers will restart on sunday no action required thanks it helpdesk',
  'thanks for your presentation the minutes of the meeting are shared please review at your convenience regards',
  'newsletter october edition office timings during the holiday notice are updated on the portal fyI',
  'the training session on safety procedures is scheduled next week please confirm your attendance in the calendar',
  'quarterly report draft attached for review comments welcome before friday standup regards project office',
  'hello everyone the office holiday list for the next quarter is published on the intranet no action required',
  'please find the approved budget summary attached for your records the finance team will follow up next month',
  'gentle reminder to submit your weekly timesheets the payroll process runs on monday regards hr team',
];

/* ---------- tokenisation + style features ---------- */

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' urltoken ')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => (/(ing|ed|es|s)$/.test(w) && w.length > 5 ? w.replace(/(ing|ed|es|s)$/, '') : w));
}

function bigrams(tokens) {
  const out = [];
  for (let i = 0; i + 1 < tokens.length; i += 1) out.push(`${tokens[i]}_${tokens[i + 1]}`);
  return out;
}

function charNgrams(text, n = 4) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const out = [];
  for (let i = 0; i + n <= t.length; i += 1) out.push(t.slice(i, i + n));
  return out;
}

/* ---------- lane 1: keyword lexicon ---------- */

export function keywordScan(text) {
  const lower = String(text || '').toLowerCase();
  const matches = [];
  let score = 0;
  Object.entries(KEYWORD_LEXICON).forEach(([id, cat]) => {
    const hits = [];
    cat.words.forEach((word) => {
      const re = new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
      const m = lower.match(new RegExp(re.source, 'gi'));
      if (m) hits.push({ word, count: m.length });
    });
    if (hits.length) {
      const catScore = Math.min(cat.weight > 0 ? 34 : 22, hits.reduce((t, h) => t + Math.min(3, h.count), 0) * Math.abs(cat.weight) * 0.45) * Math.sign(cat.weight);
      score += catScore;
      matches.push({ category: id, label: cat.label, weight: Math.round(catScore), hits });
    }
  });
  return { score: Math.max(0, Math.min(100, Math.round(score))), matches };
}

/* ---------- lane 2: NLP style + TF features ---------- */

export function nlpAnalyze(subject = '', body = '') {
  const text = `${subject}\n${body}`;
  const tokens = tokenize(text);
  const bg = bigrams(tokens);
  const signals = [];
  let score = 0;

  const capsChars = (body.match(/[A-Z]/g) || []).length;
  const letters = (body.match(/[A-Za-z]/g) || []).length || 1;
  const capsRatio = capsChars / letters;
  if (capsRatio > 0.35 && letters > 40) { score += 12; signals.push(`all-caps pressure style (caps ratio ${(capsRatio * 100).toFixed(0)}%)`); }

  const bangs = (text.match(/!/g) || []).length;
  if (bangs >= 2) { score += Math.min(12, bangs * 4); signals.push(`exclamation pressure (${bangs} '!')`); }

  const imperatives = (text.match(/\b(verify|confirm|click|send|update|login|open|enable|download|act|call|reply now|complete)\b/gi) || []).length;
  if (imperatives >= 2) { score += Math.min(16, imperatives * 6); signals.push(`imperative action verbs (${imperatives})`); }

  const moneyWords = (text.match(/\b(rs\.?|inr|usd|dollars?|rupees?|payment|transfer|invoice|bank|account|funds?)\b/gi) || []).length;
  if (moneyWords >= 2) { score += Math.min(14, moneyWords * 5); signals.push(`financial vocabulary density (${moneyWords} terms)`); }

  const secondPerson = (text.match(/\b(you|your|yours)\b/gi) || []).length;
  const threat = (text.match(/\b(suspend|cancel|terminate|legal|penalty|blocked|frozen|closed|expire)\b/gi) || []).length;
  if (threat >= 1 && secondPerson >= 1) { score += 14; signals.push('second-person threat framing'); }

  const linkCount = (text.match(/https?:\/\//gi) || []).length;
  if (linkCount >= 1) { score += Math.min(12, linkCount * 6); signals.push(`embedded hyperlinks (${linkCount})`); }

  const obfuscated = (text.match(/\b\d{4,6}\b/g) || []).length;
  if (obfuscated >= 2) { score += 8; signals.push('numeric token/OTP style content'); }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    signals,
    features: {
      token_count: tokens.length,
      unique_tokens: new Set(tokens).size,
      bigram_count: bg.length,
      caps_ratio: Number(capsRatio.toFixed(3)),
      link_count: linkCount,
    },
  };
}

/* ---------- lane 3: BERT-style semantic (hashed distilled embeddings) ---------- */

const DIM = 256;

function embed(tokens, grams) {
  const vec = new Float32Array(DIM);
  const feed = [...tokens, ...grams];
  feed.forEach((feat) => {
    let h1 = 0x811c9dc5;
    let h2 = 0x1000193;
    for (let i = 0; i < feat.length; i += 1) {
      h1 = Math.imul(h1 ^ feat.charCodeAt(i), 0x01000193);
      h2 = Math.imul(h2 + feat.charCodeAt(i) * (i + 7), 0x85ebca6b);
    }
    const idx = (h1 >>> 0) % DIM;
    const sign = (h2 & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  });
  let norm = 0;
  for (let i = 0; i < DIM; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i += 1) vec[i] /= norm;
  return vec;
}

function centroid(seedDocs) {
  const acc = new Float32Array(DIM);
  seedDocs.forEach((doc) => {
    const v = embed(tokenize(doc), [...bigrams(tokenize(doc)), ...charNgrams(doc, 4)]);
    for (let i = 0; i < DIM; i += 1) acc[i] += v[i];
  });
  let norm = 0;
  for (let i = 0; i < DIM; i += 1) norm += acc[i] * acc[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i += 1) acc[i] /= norm;
  return acc;
}

const PHISH_CENTROID = centroid(SEED_PHISHING);
const BENIGN_CENTROID = centroid(SEED_BENIGN);

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < DIM; i += 1) dot += a[i] * b[i];
  return dot;
}

export function semanticScore(subject = '', body = '') {
  const text = `${subject}\n${body}`;
  const tokens = tokenize(text);
  const vec = embed(tokens, [...bigrams(tokens), ...charNgrams(text, 4)]);
  const simPhish = cosine(vec, PHISH_CENTROID);
  const simBenign = cosine(vec, BENIGN_CENTROID);
  const margin = simPhish - simBenign; // typically -0.4 .. 0.6
  const score = Math.max(0, Math.min(100, Math.round((margin + 0.18) * 130)));
  return {
    score,
    sim_phishing: Number(simPhish.toFixed(3)),
    sim_benign: Number(simBenign.toFixed(3)),
    model: 'BERT-distilled semantic lane · 256-d hashed embeddings · offline',
  };
}

/* ---------- intent classification (SIH classes) ---------- */

export function classifyIntents(text = '') {
  const lower = String(text).toLowerCase();
  const out = [];
  INTENT_RULES.forEach((rule) => {
    const hits = rule.patterns.filter((p) => p.test(text)).length;
    const lexHits = (rule.lexicon || []).reduce((t, id) => {
      const cat = KEYWORD_LEXICON[id];
      return t + (cat ? cat.words.filter((w) => lower.includes(w)).length : 0);
    }, 0);
    const confidence = Math.min(95, hits * 32 + lexHits * 10);
    if (confidence >= 25) {
      out.push({ intent: rule.id, label: rule.label, confidence });
    }
  });
  return out.sort((a, b) => b.confidence - a.confidence);
}

/* ---------- combined entry point ---------- */

export function nlpScore({ subject = '', body = '', urls = [], attachments = [] } = {}) {
  const text = `${subject}\n${body}`;
  const keyword = keywordScan(text);
  const nlp = nlpAnalyze(subject, body);
  const semantic = semanticScore(subject, body);
  const intents = classifyIntents(text);

  // structural context from URLs / attachments feeds the combined score
  let structuralBonus = 0;
  if (urls.some((u) => (u.risk === 'REVIEW' || u.reasons?.length))) structuralBonus += 8;
  if (urls.length > 2) structuralBonus += 5;
  if (attachments.some((a) => (a.risk_score || 0) >= 40)) structuralBonus += 10;
  if (attachments.some((a) => /\.(exe|scr|js|vbs|ps1|hta|bat|cmd)$/i.test(a.filename || ''))) structuralBonus += 10;

  const base = keyword.score * 0.34 + nlp.score * 0.20 + semantic.score * 0.36 + structuralBonus;
  // critical-mass boost: multiple independent lanes agreeing is stronger than
  // any single lane — mirror of a classifier confidence margin
  let boost = 0;
  if (keyword.score >= 50 && semantic.score >= 40) boost += 12;
  if (keyword.score >= 60) boost += 8;
  if (nlp.score >= 40 && semantic.score >= 45) boost += 6;
  if (intents.some((i) => i.confidence >= 60)) boost += 10;
  if (intents.some((i) => i.intent === 'payment_diversion' && i.confidence >= 40)) boost += 8;

  const combined = Math.max(0, Math.min(100, Math.round(base + boost)));

  return {
    keyword,
    nlp,
    semantic,
    intents,
    combined,
    verdict: combined >= 70 ? 'HIGH RISK' : combined >= 40 ? 'REVIEW' : 'NO HIGH-RISK SIGNALS OBSERVED',
  };
}

export function combineOverall(structuralScore, ai) {
  const s = Number(structuralScore) || 0;
  const a = Number(ai?.combined) || 0;
  return Math.max(0, Math.min(100, Math.round(s * 0.5 + a * 0.5)));
}
