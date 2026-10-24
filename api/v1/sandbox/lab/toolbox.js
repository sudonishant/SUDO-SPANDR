// GET /api/v1/sandbox/lab/toolbox — which analysis engines this deployment has
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  return res.status(200).json({
    guest_image: 'spandr-sbx-cyberlab',
    private_targets_allowed: process.env.CYBERLAB_ALLOW_PRIVATE === '1',
    edge: true,
    tools: {
      attachment_lab: { binary: 'edge-js', available: true },
      url_lab: { binary: 'edge-js', available: true },
      auto_triage: { binary: 'edge-js', available: true },
      pcap_parser: { binary: 'edge-js', available: true },
    },
  });
}
