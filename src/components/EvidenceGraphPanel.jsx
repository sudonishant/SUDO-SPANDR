import React, { useMemo, useState } from 'react';
import { Database, GitBranch, Info, RefreshCw, ShieldCheck } from 'lucide-react';

const KIND_COLORS = {
  case: '#315f52', sender: '#a5523b', recipient: '#46758a', domain: '#7a6334',
  ip: '#586e9b', url: '#9a6a32', attachment: '#8a5574', reported_auth: '#64558e',
};
const KIND_LABELS = {
  case: 'Case', sender: 'Claimed sender', recipient: 'Recipient', domain: 'Domain',
  ip: 'Header IP', url: 'Sanitized URL', attachment: 'Attachment', reported_auth: 'Reported auth',
};

function short(value, length = 23) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function graphLayout(graph) {
  const nodes = graph?.nodes || [];
  const caseNode = nodes.find((node) => node.kind === 'case') || nodes[0];
  const others = nodes.filter((node) => node.id !== caseNode?.id);
  const width = 1200;
  const height = 680;
  const positions = new Map();
  if (caseNode) positions.set(caseNode.id, { x: width / 2, y: height / 2, node: caseNode });
  others.forEach((node, index) => {
    const inner = others.length > 18 && index % 2 === 1;
    const rx = inner ? 285 : 485;
    const ry = inner ? 150 : 265;
    const angle = -Math.PI / 2 + (index / Math.max(others.length, 1)) * Math.PI * 2;
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * rx,
      y: height / 2 + Math.sin(angle) * ry,
      node,
    });
  });
  return { width, height, positions };
}

function GraphReadback({ result }) {
  const graph = result.graph || { nodes: [], edges: [] };
  const [selectedId, setSelectedId] = useState(graph.nodes.find((node) => node.kind === 'case')?.id || graph.nodes[0]?.id);
  const layout = useMemo(() => graphLayout(graph), [graph]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selected = nodeById.get(selectedId) || graph.nodes[0];
  const selectedRelations = selected
    ? graph.edges.filter((edge) => edge.source === selected.id || edge.target === selected.id)
    : [];

  return (
    <div className="evidence-graph-result">
      <div className="evidence-graph-status evidence-graph-status--available">
        <Database size={17} />
        <div><strong>Neo4j database readback verified</strong><span>{result.counts?.nodes ?? graph.nodes.length} nodes · {result.counts?.relationships ?? graph.edges.length} relationships · database {result.database_name || 'neo4j'}</span></div>
        <span className="mini-badge neutral">{result.source}</span>
      </div>

      <div className="evidence-graph-canvas" tabIndex={0} role="region" aria-label="Scrollable Neo4j evidence graph drawing">
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={`Neo4j readback graph with ${graph.nodes.length} evidence nodes and ${graph.edges.length} relationships`}>
          <defs>
            <marker id="evidence-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a5b3ac" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = layout.positions.get(edge.source);
            const target = layout.positions.get(edge.target);
            if (!source || !target) return null;
            const shorten = (point, other, amount) => {
              const dx = other.x - point.x;
              const dy = other.y - point.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              return { x: point.x + (dx / distance) * amount, y: point.y + (dy / distance) * amount };
            };
            const start = shorten(source, target, source.node.kind === 'case' ? 56 : 31);
            const end = shorten(target, source, target.node.kind === 'case' ? 60 : 36);
            return <line key={edge.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className="evidence-graph-edge" markerEnd="url(#evidence-graph-arrow)"><title>{edge.kind}</title></line>;
          })}
          {[...layout.positions.values()].map(({ node, x, y }) => {
            const isCase = node.kind === 'case';
            const color = KIND_COLORS[node.kind] || '#65776e';
            return (
              <g key={node.id} transform={`translate(${x},${y})`} className="evidence-graph-node">
                {isCase ? <rect x="-62" y="-37" width="124" height="74" rx="19" fill={color} /> : <circle r="27" fill={color} />}
                <text textAnchor="middle" dominantBaseline="central" className="evidence-graph-node__symbol">{isCase ? 'CASE' : (KIND_LABELS[node.kind] || node.kind).slice(0, 2).toUpperCase()}</text>
                <text y={isCase ? 55 : 42} textAnchor="middle" className="evidence-graph-node__label">{short(node.label, isCase ? 24 : 20)}</text>
                <title>{`${KIND_LABELS[node.kind] || node.kind}: ${node.label}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="evidence-graph-legend" aria-label="Evidence node types">
        {Object.entries(KIND_LABELS).filter(([kind]) => graph.nodes.some((node) => node.kind === kind)).map(([kind, label]) => (
          <span key={kind}><i style={{ background: KIND_COLORS[kind] }} />{label}</span>
        ))}
      </div>

      <div className="evidence-graph-inspector">
        <div>
          <span>DATABASE NODE DIRECTORY</span>
          <div className="evidence-graph-node-list">
            {graph.nodes.map((node) => <button type="button" key={node.id} className={selected?.id === node.id ? 'active' : ''} onClick={() => setSelectedId(node.id)}><i style={{ background: KIND_COLORS[node.kind] || '#65776e' }} />{short(node.label, 38)}</button>)}
          </div>
        </div>
        <div className="evidence-graph-selected">
          <span>SELECTED READBACK NODE</span>
          {selected ? <>
            <strong>{selected.label}</strong>
            <small>{KIND_LABELS[selected.kind] || selected.kind}</small>
            <dl tabIndex={0}>{Object.entries(selected.properties || {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}</dl>
            <div className="evidence-graph-relations">
              {selectedRelations.length ? selectedRelations.map((edge) => {
                const outgoing = edge.source === selected.id;
                const other = nodeById.get(outgoing ? edge.target : edge.source);
                return <p key={edge.id}><code>{outgoing ? selected.label : other?.label}</code><strong>{edge.kind}</strong><code>{outgoing ? other?.label : selected.label}</code></p>;
              }) : <p>No relationship to this node was returned.</p>}
            </div>
          </> : <p>No node was returned.</p>}
        </div>
      </div>
      <p className="disclaimer">The drawing is a visualization of the Neo4j response above; it is not independent evidence. Select any directory node to inspect its returned properties and relationships.</p>
    </div>
  );
}

export default function EvidenceGraphPanel({ data, onProject, loading }) {
  const result = data.neo4j_graph;
  const available = result?.status === 'available' && result?.readback && result?.source === 'neo4j_readback' && result?.graph?.nodes?.length;
  return (
    <div className="evidence-graph-panel">
      <div className="evidence-graph-intro">
        <div className="evidence-graph-intro__icon"><GitBranch size={21} /></div>
        <div><small>CASE-SCOPED EVIDENCE GRAPH</small><h4>Project metadata, then read it back from Neo4j.</h4><p>The case connects claimed sender, recipient, parsed domains, header IPs, sanitized URLs, attachment metadata and reported authentication results. No origin or campaign attribution is inferred.</p></div>
      </div>
      <div className="evidence-graph-disclosure">
        <ShieldCheck size={16} />
        <p><strong>Explicit metadata egress.</strong> This action sends the case ID/hash, sender/recipient addresses, IP evidence, URL host/path without query or fragment, attachment metadata and reported-auth summaries to the configured backend and Neo4j. Raw EML/MSG bytes, subject, body, arbitrary headers, attachment content, map coordinates and credentials are not included. URL userinfo is removed in the browser.</p>
      </div>
      <div className="evidence-graph-action">
        <button type="button" className="app-btn app-btn--sm" onClick={() => onProject()} disabled={loading}>
          <span className="app-btn__icon" style={{ background: 'linear-gradient(160deg,#72ac93,#3f7662)' }}>{loading ? <RefreshCw size={13} className="spin" /> : <Database size={13} />}</span>
          {loading ? 'Writing and reading Neo4j…' : available ? 'Re-project + verify readback' : 'Project + read Neo4j graph'}
        </button>
        <small>Success requires both a committed write and a matching case-scoped database query. An unavailable or unconfigured service remains visible as such.</small>
      </div>

      {result && !available && !['not_requested'].includes(result.status) ? (
        <div className={`evidence-graph-status evidence-graph-status--${result.status === 'not_configured' ? 'pending' : 'unavailable'}`} role="status">
          <Info size={17} /><div><strong>{result.status === 'not_configured' ? 'Neo4j not configured' : 'Neo4j graph unavailable'}</strong><span>{result.message || result.detail || 'No database readback was obtained. No synchronized graph is claimed.'}</span></div>
        </div>
      ) : null}
      {available ? <GraphReadback key={`${data.case_id}-${result.projected_at || 'readback'}`} result={result} /> : null}
      {result?.limitations?.length && available ? <div className="limitation-list">{result.limitations.map((item, index) => <p key={index}>{item}</p>)}</div> : null}
    </div>
  );
}
