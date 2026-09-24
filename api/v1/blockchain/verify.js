export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const txHash = req.query.tx_hash || req.query.hash || (req.url.split('/').pop().split('?')[0]) || 'none';

  // Generate a deterministic local Merkle proof from the tx hash
  const crypto = require('crypto');
  const localHash = crypto.createHash('sha256').update(txHash + ':sudospandr:sih26106').digest('hex');

  return res.status(200).json({
    verified: false,
    status: 'PROTOTYPE_MERKLE_PROOF',
    mode: 'PROTOTYPE_NOTARY_ADAPTER',
    tx_hash: txHash,
    local_merkle_root: '0x' + localHash,
    smart_contract_source: 'contracts/EvidenceNotary.sol',
    target_network: 'Polygon Amoy Testnet (ChainId 80002)',
    contract_deployed: false,
    note: 'Local SHA-256 Merkle proof generated. Smart contract (EvidenceNotary.sol) is ready for Polygon Amoy deployment but has not yet been deployed on-chain. This is a prototype notarization adapter — no on-chain verification has occurred.',
    legal_compliance: {
      status: 'PROTOTYPE_ONLY',
      note: 'Section 65B(4) IEA / Section 63 BSA 2023 certification requires on-chain immutable anchoring. Currently using local Merkle proofs as interim evidence hash.'
    },
    timestamp: new Date().toISOString()
  });
};
