module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const schema_sql = `-- =============================================================================
-- SUDO SPANDR SENTINELMAIL: SUPABASE POSTGRESQL SCHEMA (SIH 2026 #26106)
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard
-- =============================================================================

CREATE TABLE IF NOT EXISTS forensic_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id VARCHAR(64) UNIQUE NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    threat_score NUMERIC(5, 2) NOT NULL,
    threat_status VARCHAR(32) NOT NULL,
    category_label VARCHAR(128) NOT NULL,
    sender VARCHAR(255),
    recipient VARCHAR(255),
    subject TEXT,
    origin_ip VARCHAR(64),
    origin_country VARCHAR(64),
    origin_asn VARCHAR(64),
    blockchain_tx_hash VARCHAR(128),
    blockchain_block_number BIGINT,
    blockchain_merkle_root VARCHAR(128),
    evidence_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE forensic_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated investigators to read cases"
    ON forensic_cases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow service role full access"
    ON forensic_cases FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
`;

  return res.status(200).json({
    schema_sql,
    config: {
      url: process.env.SUPABASE_URL || "LOCAL_STORAGE_VAULT",
      has_credentials: Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)),
      table_name: "forensic_cases"
    }
  });
};
