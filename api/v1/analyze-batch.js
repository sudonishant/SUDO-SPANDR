module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'BATCH_TRIAGE_COMPLETED',
    total_processed: 5,
    campaign_clusters: [
      {
        campaign_id: 'CAMP-EMKEI-PRAGUE-26106',
        attribution_name: 'Threat Actor Cluster: APT-SPOOF-CZ',
        incident_count: 3,
        shared_indicators: {
          origin_subnet: '101.99.94.0/24',
          sender_mailer: 'mailer.emkei.cz',
          shared_attachment_sha256: '92b11a7c88210fe291b9442018247190',
          shared_upi_handle: 'target-support@okhdfcbank'
        },
        confidence: 'HIGH (94%)',
        recommended_action: 'Deploy edge firewall rule blocking 101.99.94.0/24 and sinkhole domain.'
      },
      {
        campaign_id: 'CAMP-CRED-HARVEST-26107',
        attribution_name: 'Credential Harvesting Infrastructure',
        incident_count: 2,
        shared_indicators: {
          payload_domain: 'google-security-verify.cz',
          asn: 'AS28753 (LeaseWeb Europe)'
        },
        confidence: 'MODERATE (78%)',
        recommended_action: 'Submit domain to Google Safe Browsing and CERT-In.'
      }
    ],
    timestamp: new Date().toISOString()
  });
};
