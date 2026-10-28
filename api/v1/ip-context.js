const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

function isPublicIpv4(ip) {
  if (!IPV4.test(ip)) return false;
  const octets = ip.split('.').map(Number);
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && (octets[2] === 0 || octets[2] === 2)) || (a === 192 && b === 88 && octets[2] === 99) || (a === 198 && b === 51 && octets[2] === 100) || (a === 203 && b === 0 && octets[2] === 113)) return false;
  return true;
}

function vcardValue(entity, key) {
  const vcard = entity?.vcardArray?.[1];
  if (!Array.isArray(vcard)) return '';
  const row = vcard.find((item) => item?.[0] === key);
  return Array.isArray(row?.[3]) ? row[3].filter(Boolean).join(', ') : String(row?.[3] || '');
}

function entityLabel(entity) {
  return vcardValue(entity, 'fn') || vcardValue(entity, 'org') || entity?.handle || '';
}

function classifyNetwork(text) {
  const value = String(text || '').toLowerCase();
  if (/amazon|aws|amazonaws|google|google cloud|microsoft|azure|cloudflare|digitalocean|oracle cloud|alibaba cloud|linode|vultr|hetzner|ovh|hosting|datacenter|data center|cloud/.test(value)) return { type: 'LIKELY HOSTING / CLOUD NETWORK', basis: 'Registration or provider text contains a hosting, cloud, datacenter, or major provider indicator.' };
  if (/vpn|proxy|tor|anonym|privacy/.test(value)) return { type: 'PRIVACY / PROXY INDICATOR', basis: 'Registration or provider text contains a proxy, VPN, Tor, or privacy-network indicator.' };
  if (/telecom|mobile|wireless|cellular|broadband|internet|communications|isp|cable|fiber/.test(value)) return { type: 'LIKELY ISP / ACCESS NETWORK', basis: 'Registration or provider text contains an access-provider indicator.' };
  return { type: 'NETWORK TYPE NOT DETERMINED', basis: 'Available registration/provider text did not provide a conservative network-type signal.' };
}

async function getJson(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await fetch(url, { signal: controller.signal, headers });
    const payload = await result.json().catch(() => ({}));
    return { result, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function lookupRegistration(ip) {
  try {
    const { result, payload } = await getJson(`https://rdap.org/ip/${encodeURIComponent(ip)}`, 8_000, { accept: 'application/rdap+json, application/json' });
    if (!result.ok) return { status: 'unavailable', message: `RDAP returned HTTP ${result.status}.` };
    const entities = Array.isArray(payload.entities) ? payload.entities : [];
    const registrant = entities.find((entity) => entity.roles?.includes('registrant')) || entities.find((entity) => entity.roles?.includes('administrative')) || entities[0];
    return {
      status: 'available',
      country: payload.country || vcardValue(registrant, 'adr').split(',').filter(Boolean).at(-1) || null,
      network_name: payload.name || payload.handle || null,
      organization: entityLabel(registrant) || null,
      handle: payload.handle || null,
      range: payload.startAddress && payload.endAddress ? `${payload.startAddress} – ${payload.endAddress}` : null,
      remarks: payload.remarks?.map((item) => item?.description?.join(' ')).join(' ') || '',
      source: 'Public RDAP registration data via rdap.org',
    };
  } catch (error) {
    return { status: 'unavailable', message: error?.name === 'AbortError' ? 'RDAP lookup timed out.' : 'RDAP lookup failed.' };
  }
}

async function lookupApproximateLocation(ip) {
  try {
    const { result, payload } = await getJson(`https://ipwho.is/${encodeURIComponent(ip)}`, 7_000, { accept: 'application/json' });
    if (!result.ok || payload.success === false) return { status: 'unavailable', message: payload?.message || `Approximate-location provider returned HTTP ${result.status}.` };
    const hasCoordinateValues = payload.latitude !== null && payload.latitude !== undefined && payload.latitude !== '' && payload.longitude !== null && payload.longitude !== undefined && payload.longitude !== '';
    const latitude = hasCoordinateValues ? Number(payload.latitude) : NaN;
    const longitude = hasCoordinateValues ? Number(payload.longitude) : NaN;
    const coordinatesValid = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
    return {
      status: coordinatesValid ? 'available' : 'unavailable',
      message: coordinatesValid ? null : 'The provider did not return valid approximate coordinates.',
      city: payload.city || null,
      region: payload.region || null,
      country: payload.country || null,
      country_code: payload.country_code || null,
      latitude: coordinatesValid ? latitude : null,
      longitude: coordinatesValid ? longitude : null,
      postal: null,
      connection: payload.connection || null,
      timezone: payload.timezone?.id || null,
      source: 'Approximate IP geolocation via ipwho.is',
      accuracy: 'Not specified by provider; treat as an approximate estimate.',
    };
  } catch (error) {
    return { status: 'unavailable', message: error?.name === 'AbortError' ? 'Approximate-location lookup timed out.' : 'Approximate-location lookup failed.' };
  }
}

async function lookup(ip) {
  const [registration, location] = await Promise.all([lookupRegistration(ip), lookupApproximateLocation(ip)]);
  const available = registration.status === 'available' || location.status === 'available';
  const network = classifyNetwork(`${registration.network_name || ''} ${registration.organization || ''} ${registration.remarks || ''} ${location.connection?.org || ''} ${location.connection?.isp || ''}`);
  const messages = [registration.message, location.message].filter(Boolean);
  return {
    ip,
    status: available ? 'available' : 'unavailable',
    message: messages.length ? messages.join(' ') : null,
    country: registration.country || location.country || null,
    region: null,
    network_name: registration.network_name || null,
    organization: registration.organization || location.connection?.org || location.connection?.isp || null,
    handle: registration.handle || null,
    range: registration.range || null,
    network_type: network.type,
    network_type_basis: network.basis,
    source: [registration.source, location.source].filter(Boolean).join(' · '),
    registration_status: registration.status,
    location_status: location.status,
    city: location.city || null,
    latitude: location.latitude,
    longitude: location.longitude,
    approximate_location: location,
    exact_location: 'NOT PROVIDED',
    note: 'RDAP describes network registration; the map uses an independent approximate IP-geolocation estimate. Neither establishes the sender\'s exact location, identity, physical address, or the geographic order of relays. Cloud, VPN, proxy, and hosting networks can point to infrastructure rather than an end user.',
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'method_not_allowed', message: 'Use POST with public header IPs.' });

  let ips;
  try {
    const input = req.body || {};
    ips = Array.isArray(input?.ips) ? [...new Set(input.ips.map((ip) => String(ip).trim()).filter(isPublicIpv4))].slice(0, 5) : [];
  } catch {
    return res.status(400).json({ status: 'invalid_request', message: 'Expected a JSON body with an ips array.' });
  }
  if (!ips.length) return res.status(200).json({ status: 'no_public_ips', results: [], message: 'No public IPv4 address from submitted email headers was available for lookup.' });
  const results = await Promise.all(ips.map(lookup));
  return res.status(200).json({
    status: 'available',
    results,
    providers: ['rdap.org', 'ipwho.is'],
    privacy: 'Only the extracted public IP addresses were sent to these providers after an explicit lookup action.',
    note: 'Registration and approximate IP-geolocation context are not exact geolocation or sender attribution.',
  });
}
