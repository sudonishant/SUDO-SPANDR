# Credential remediation — 13 October 2026

Historical Supabase service-role JWTs and Neo4j passwords must be revoked/rotated even though current source uses environment values. Keep SUPABASE_KEY and NEO4J_PASSWORD server-side only. A separate coordinated history rewrite is required to remove old committed values.

## Required owner actions

- Revoke/rotate all previously exposed provider credentials; removing source does not revoke them.
- Review provider usage, billing, account and database access logs.
- Coordinate cleanup of affected branches/tags/history. Old commits, cached views, clones, forks, releases and deployed bundles may retain credential material.
- Redeploy/rebuild affected applications after configuring rotated server-side secrets. Never restore old credentials to source.
- Use dummy test fixtures and secret scanning/push protection. Base64 or splitting a credential is not protection.

No credential values are recorded in this document. Git history has not been rewritten by this source-cleanup commit.
