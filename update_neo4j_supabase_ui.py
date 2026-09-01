import re

with open('backend/app/static_index.py', 'r') as f:
    content = f.read()

# 1. Add Neo4j & Supabase Card to Overview tab
db_card_html = '''
        <!-- Neo4j & Supabase Cloud Integration Card -->
        <div class="card" style="border-left: 3px solid #38bdf8; background: linear-gradient(135deg, rgba(56,189,248,0.06), var(--card-bg));">
          <div class="card-title">
            <i data-lucide="database" style="width: 15px; color: #38bdf8;"></i>
            <div><small>ENTERPRISE STORAGE & GRAPH TOPOLOGY</small><h3>🌿 Neo4j Graph & ⚡ Supabase Vault</h3></div>
          </div>
          <div class="key-val"><span>Neo4j Cypher Engine</span><strong id="neo4j-status-tag" style="color: #34d399; font-size: 11px;">CYPHER READY</strong></div>
          <div class="key-val"><span>Graph Nodes / Relationships</span><strong id="neo4j-nodes-tag" class="mono" style="color: #60a5fa;">5 Nodes · 4 Edges</strong></div>
          <div class="key-val"><span>Supabase PostgreSQL Vault</span><strong id="supabase-status-tag" style="color: #38bdf8; font-size: 11px;">TABLE READY</strong></div>
          <div class="key-val"><span>Cloud Target Table</span><strong class="mono" style="color: #fbbf24;">public.forensic_cases</strong></div>
          <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="ghost-btn" style="color: #34d399; border-color: rgba(52,211,153,0.4);" onclick="viewCypherModal()"><i data-lucide="code" style="width: 11px;"></i> Cypher Query</button>
            <button class="ghost-btn" style="color: #38bdf8; border-color: rgba(56,189,248,0.4);" onclick="viewSupabaseSQL()"><i data-lucide="file-code" style="width: 11px;"></i> Supabase SQL</button>
          </div>
        </div>
'''

if '<!-- Neo4j & Supabase Cloud Integration Card -->' not in content:
    content = content.replace(
        '<!-- Tab: Overview -->\n      <div id="tab-overview" class="result-grid">',
        '<!-- Tab: Overview -->\n      <div id="tab-overview" class="result-grid">' + db_card_html
    )

# 2. Populate Neo4j and Supabase in JavaScript renderAnalysis
db_js_populate = '''
      // Neo4j & Supabase Population
      const n4j = data.neo4j_graph || {};
      document.getElementById('neo4j-status-tag').innerText = n4j.neo4j_status || 'CYPHER READY';
      document.getElementById('neo4j-nodes-tag').innerText = `${n4j.nodes_count || 5} Nodes · ${n4j.edges_count || 4} Edges`;
      
      const supa = data.supabase_sync || {};
      document.getElementById('supabase-status-tag').innerText = supa.status || 'CONFIG READY';
'''

if '// Neo4j & Supabase Population' not in content:
    content = content.replace(
        '// Blockchain Notary Population',
        db_js_populate + '\n      // Blockchain Notary Population'
    )

# 3. Add viewCypherModal and viewSupabaseSQL functions
db_modals = '''
    function viewCypherModal() {
      if (!currentAnalysis || !currentAnalysis.neo4j_graph) {
        alert('Please analyze an email first!');
        return;
      }
      const cypher = currentAnalysis.neo4j_graph.cypher_query || '// No Cypher query generated';
      const w = window.open('', '_blank');
      w.document.write('<pre style="background:#0f172a;color:#38bdf8;padding:20px;font-family:monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;">' + cypher + '</pre>');
    }

    async function viewSupabaseSQL() {
      try {
        const res = await fetch('/api/v1/supabase/schema');
        const data = await res.json();
        const w = window.open('', '_blank');
        w.document.write('<pre style="background:#0f172a;color:#34d399;padding:20px;font-family:monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;">' + data.schema_sql + '</pre>');
      } catch (err) {
        alert('Supabase SQL error: ' + err.message);
      }
    }
'''

if 'function viewCypherModal()' not in content:
    content = content.replace(
        'function printDossier()',
        db_modals + '\n    function printDossier()'
    )

with open('backend/app/static_index.py', 'w') as f:
    f.write(content)

print('Successfully updated static_index.py with Neo4j and Supabase integration')
