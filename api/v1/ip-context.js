const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function isPublicIpv4(ip) {
  if (!IPV4.test(ip)) return false;
  const octets = ip.split('.').map(Number);
  const [a, b] = octets;
  if (a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || (a === 192 && b === 0 && octets[2] === 2) || (a === 203 && b === 0 && octets[2] === 113)) return false;
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
  if (/amazon|aws|amazonaws|google|google cloud|microsoft|azure|cloudflare|digitalocean|oracle cloud|alibaba cloud|linode|vultr|hetzner|ovh|hosting|datacenter|data center|cloud/.test(value)) return { type: 'LIKELY HOSTING / CLOUD NETWORK', basis: 'Registration text contains a hosting, cloud, datacenter, or major provider indicator.' };
  if (/vpn|proxy|tor|anonym|privacy/.test(value)) return { type: 'PRIVACY / PROXY INDICATOR', basis: 'Registration text contains a proxy, VPN, Tor, or privacy-network indicator.' };
  if (/telecom|mobile|wireless|cellular|broadband|internet|communications|isp|cable|fiber/.test(value)) return { type: 'LIKELY ISP / ACCESS NETWORK', basis: 'Registration text contains an access-provider indicator.' };
  return { type: 'NETWORK TYPE NOT DETERMINED', basis: 'RDAP registration text did not provide a conservative network-type signal.' };
}

async function lookup(ip) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const result = await fetch(`https://rdap.org/ip/${encodeURIComponent(ip)}`, { signal: controller.signal, headers: { accept: 'application/rdap+json, application/json' } });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) return { ip, status: 'unavailable', message: `RDAP returned HTTP ${result.status}.` };
    const entities = Array.isArray(payload.entities) ? payload.entities : [];
    const registrant = entities.find((entity) => entity.roles?.includes('registrant')) || entities.find((entity) => entity.roles?.includes('administrative')) || entities[0];
    const networkName = payload.name || payload.handle || '';
    const organization = entityLabel(registrant);
    const country = payload.country || vcardValue(registrant, 'adr').split(',').filter(Boolean).at(-1) || null;
    const network = classifyNetwork(`${networkName} ${organization} ${payload.remarks?.map((item) => item?.description?.join(' ')).join(' ') || ''}`);
    return {
      ip,
      status: 'available',
      country,
      region: null,
      network_name: networkName || null,
      organization: organization || null,
      handle: payload.handle || null,
      range: payload.startAddress && payload.endAddress ? `${payload.startAddress} – ${payload.endAddress}` : null,
      network_type: network.type,
      network_type_basis: network.basis,
      source: 'Public RDAP registration data via rdap.org',
      exact_location: 'NOT PROVIDED',
      note: 'This is approximate network registration context for the extracted header IP. It is not the sender\'s exact location, identity, or physical address; cloud/VPN/proxy networks may represent the server or exit point instead of the end user.',
    };
  } catch (error) {
    return { ip, status: 'unavailable', message: error?.name === 'AbortError' ? 'RDAP lookup timed out.' : 'RDAP lookup failed.' };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  if (request.method !== 'POST') return response({ status: 'method_not_allowed', message: 'Use POST with public header IPs.' }, 405);
  let ips;
  try {
    const input = await request.json();
    ips = Array.isArray(input?.ips) ? [...new Set(input.ips.map((ip) => String(ip).trim()).filter(isPublicIpv4))].slice(0, 5) : [];
  } catch {
    return response({ status: 'invalid_request', message: 'Expected a JSON body with an ips array.' }, 400);
  }
  if (!ips.length) return response({ status: 'no_public_ips', results: [], message: 'No public IPv4 address from submitted email headers was available for lookup.' });
  const results = await Promise.all(ips.map(lookup));
  return response({ status: 'available', results, note: 'RDAP registration context is approximate metadata, not exact geolocation or sender attribution.' });
}
