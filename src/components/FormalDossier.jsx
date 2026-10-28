import React, { useMemo } from 'react';
import { Download, FileCheck2, MapPin, Printer, ShieldCheck } from 'lucide-react';
import NetworkMap, { hasApproximateCoordinates } from './NetworkMap';
import { buildDossierModel, formatBytes, networkPlace, text } from '../lib/dossierModel';
import { buildGovReport, openGovReport } from '../lib/reportGov';

function ReportSection({ number, title, subtitle, children, className = '' }) {
  return (
    <section className={`formal-section ${className}`}>
      <header className="formal-section__header">
        <span>{number}</span>
        <div><h3>{title}</h3>{subtitle ? <p>{subtitle}</p> : null}</div>
      </header>
      <div className="formal-section__body">{children}</div>
    </section>
  );
}

function DetailTable({ rows, className = '' }) {
  return (
    <div className={`formal-table-wrap ${className}`} tabIndex={0} role="region" aria-label="Scrollable case detail table">
      <table className="formal-table formal-table--details">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td className={row.mono ? 'mono' : ''}>{text(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReaSummary({ rea }) {
  if (!rea) return <div className="formal-empty">REA deep inspection was not run for this case. The local browser findings above remain available and are not represented as REA output.</div>;
  return (
    <div className="formal-rea">
      <div className="formal-rea__meta">
        <span>Engine <strong>{text(rea.engine?.name, 'REA')} {rea.engine?.version || ''} · {rea.engine?.package || 'package not reported'}</strong></span>
        <span>Status <strong>{text(rea.status)}</strong></span>
        <span>Matched evidence <strong>{text(rea.matched_evidence)}</strong></span>
        <span>Submitted SHA-256 <strong className="mono">{text(rea.file?.sha256 || rea.file_sha256)}</strong></span>
      </div>
      {(rea.lanes || []).map((lane, index) => (
        <div className="formal-rea__lane" key={`${lane.id || lane.operation}-${index}`}>
          <strong>{text(lane.operation || lane.id)} · {text(lane.status)}</strong>
          <span>{text(lane.provider?.name || lane.summary?.provider?.name, 'Provider not reported')}</span>
          {lane.message ? <p>{lane.message}</p> : null}
          {(lane.limitations || lane.summary?.limitations || []).slice(0, 12).map((item, itemIndex) => <p key={itemIndex}>Limitation: {item}</p>)}
        </div>
      ))}
      {(rea.limitations || []).map((item, index) => <p key={index}>{item}</p>)}
      {!rea.lanes?.length ? <p>{text(rea.message, 'No completed REA lane was recorded.')}</p> : null}
    </div>
  );
}

export default function FormalDossier({ data, children }) {
  const model = useMemo(() => buildDossierModel(data), [data]);
  const openStandalone = () => openGovReport(buildGovReport({ analysis: data }), model.caseId);

  return (
    <article className={`dossier dossier--formal formal-dossier print-area risk-${model.risk.toLowerCase()}`} aria-label="Formal forensic analyst working report">
      <div className="dossier__actions no-print">
        <div><FileCheck2 size={16} /><span>Detailed report · {model.documentStatus}</span></div>
        <div>
          <button type="button" className="app-btn app-btn--sm" onClick={openStandalone}><span className="app-btn__icon"><Download size={13} /></span>Open standalone HTML</button>
          <button type="button" className="app-btn app-btn--sm" onClick={() => window.print()}><span className="app-btn__icon"><Printer size={13} /></span>Print / save PDF</button>
        </div>
      </div>

      <header className="formal-masthead">
        <div className="formal-masthead__nonofficial">NON-GOVERNMENTAL · ANALYST WORKING DOCUMENT · NOT A CERTIFICATE</div>
        <div className="formal-masthead__brand">
          <img src="/spandr-mark.png" alt="" width="58" height="58" />
          <div><strong>SUDO SPANDR</strong><span>SentinelMail · Evidence analysis workbench</span></div>
          <div className="formal-masthead__docno"><span>Document number</span><strong>{model.documentNumber}</strong></div>
        </div>
        <div className="formal-masthead__title">
          <p>{model.handling}</p>
          <h2 lang="hi">{model.title}</h2>
          <h3>{model.subtitle}</h3>
          <span>Indian-format documentation layout · independent analyst review required</span>
        </div>
        <div className="formal-masthead__ledger">
          <span>Case <strong>{model.caseId}</strong></span>
          <span>Generated <strong>{model.generatedLabel}</strong></span>
          <span>Status <strong>{model.documentStatus}</strong></span>
        </div>
      </header>

      <div className="formal-summary">
        <div className={`formal-summary__risk risk-${model.risk.toLowerCase()}`}><span>TRIAGE ASSESSMENT</span><strong>{model.threatStatus}</strong><small>{model.score}/100 · heuristic score, not probability</small></div>
        <div><span>PRIMARY CATEGORY</span><strong>{text(model.category.category_label)}</strong><small>{text(model.category.confidence, '0')}% evidence coverage</small></div>
        <div><span>SUBMITTED SIZE</span><strong>{formatBytes(data.evidence?.raw_size_bytes ?? data.parsed?.meta?.size_bytes)}</strong><small>Original bytes not embedded</small></div>
        <div><span>FILE MARKERS</span><strong>{model.attachments.length}</strong><small>Static browser inspection</small></div>
        <div><span>PUBLIC IP EVIDENCE</span><strong>{model.relays.length}</strong><small>{model.networkResults.length} context result(s)</small></div>
      </div>

      <ReportSection number="01" title="Case and evidence identification" subtitle="Submitted values and processing provenance">
        <DetailTable rows={model.metadata} />
      </ReportSection>

      <ReportSection number="02" title="Evidence integrity and handling record" subtitle="What is computed here—and what must still be documented separately">
        <DetailTable rows={model.integrity} />
        <div className="formal-notice"><ShieldCheck size={17} /><p>The digest supports later comparison; it does not prove who handled the evidence, when it was acquired, or that custody was continuous. No write-once preservation or independent verification is claimed.</p></div>
      </ReportSection>

      <ReportSection number="03" title="Triage assessment and observed findings" subtitle="Explainable signals only; category points are not silently added to the threat score">
        <div className="formal-assessment">
          <div><span>Category</span><strong>{text(model.category.category_label)}</strong><p>{text(model.category.description)}</p></div>
          <div><span>Triage interpretation</span><strong>{model.threatStatus}</strong><p>{model.threatNote}</p></div>
        </div>
        {model.scoreBreakdown?.formula ? <div className="formal-formula"><span>SCORE FORMULA</span><code>{model.scoreBreakdown.formula}</code></div> : null}
        <div className="formal-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence table">
          <table className="formal-table">
            <thead><tr><th>Observed finding</th><th>Evidence / explanation</th><th>Weight</th></tr></thead>
            <tbody>
              {model.findings.length ? model.findings.map((item, index) => <tr key={`${item.label}-${index}`}><td>{item.label}</td><td>{item.evidence}</td><td>{item.weight === null ? 'Recorded' : `+${item.weight}`}</td></tr>) : <tr><td colSpan="3">No positive threat signal was recorded. This is not a clean or safe verdict.</td></tr>}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection number="04" title="Email authentication evidence" subtitle="Reported header observations, not independent DNS or cryptographic verification">
        {model.authentication ? (
          <>
            <div className="formal-auth-grid">{model.authentication.values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{text(value)}</strong></div>)}</div>
            <DetailTable rows={[{ label: 'Reported header', value: model.authentication.reportedHeader }, { label: 'Evidence source fields', value: model.authentication.sources.join(' · ') || 'None recognised' }, { label: 'Reported value (bounded)', value: model.authentication.raw, mono: true }]} />
            <p className="formal-note">{model.authentication.note}</p>
          </>
        ) : <div className="formal-empty">Not applicable to a standalone attachment. No SPF, DKIM, DMARC, or ARC conclusion is made.</div>}
      </ReportSection>

      <ReportSection number="05" title="IP evidence and approximate network context" subtitle="IP addresses remain visible even when provider lookup or map coordinates fail">
        <div className="formal-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence table">
          <table className="formal-table">
            <thead><tr><th>#</th><th>Extracted IP</th><th>Header field</th><th>Evidence order</th></tr></thead>
            <tbody>{model.relays.length ? model.relays.map((item, index) => <tr key={`${item.ip}-${index}`}><td>{index + 1}</td><td className="mono">{item.ip}</td><td>{text(item.field)}</td><td>{index + 1} of {model.relays.length}</td></tr>) : <tr><td colSpan="4">No public IP was extracted. Map and relay-context analysis are not available.</td></tr>}</tbody>
          </table>
        </div>
        <p className="formal-note">{model.relayStatus}. {model.relayNote}</p>
        <NetworkMap results={model.networkResults} compact />
        <div className="formal-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence table">
          <table className="formal-table">
            <thead><tr><th>IP</th><th>Approximate provider place</th><th>Coordinates</th><th>Network / registration</th><th>Lookup state</th></tr></thead>
            <tbody>{model.networkResults.length ? model.networkResults.map((item, index) => (
              <tr key={`${item.ip}-context-${index}`}>
                <td className="mono">{item.ip}</td>
                <td>{networkPlace(item)}</td>
                <td className="mono">{hasApproximateCoordinates(item) ? `${item.latitude ?? item.approximate_location?.latitude}, ${item.longitude ?? item.approximate_location?.longitude}` : 'Not returned'}</td>
                <td>{text(item.organization || item.network_name)}<br /><small>{text(item.network_type)}</small></td>
                <td>{text(item.status)}<br /><small>Registration: {text(item.registration_status)} · Location: {text(item.location_status)}</small><br /><small>{text(item.message || item.approximate_location?.accuracy, 'Approximate estimate; no accuracy radius supplied.')}</small></td>
              </tr>
            )) : <tr><td colSpan="5">{model.networkStatus} — {model.networkNote}</td></tr>}</tbody>
          </table>
        </div>
        <div className="formal-notice formal-notice--map"><MapPin size={17} /><p>{model.networkNote} {model.networkPrivacy} Map markers are not connected in relay order and must not be read as a route.</p></div>
      </ReportSection>

      <ReportSection number="06" title="URL and attachment observations" subtitle="Structural/static findings; no reputation, sandbox, antivirus, or clean-file verdict">
        <h4 className="formal-subheading">Extracted URLs ({model.urls.length})</h4>
        <div className="formal-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence table"><table className="formal-table"><thead><tr><th>URL</th><th>Structural assessment</th><th>Reason</th></tr></thead><tbody>{model.urls.length ? model.urls.map((item, index) => <tr key={`${item.url}-${index}`}><td className="mono wrap-anywhere">{item.url}</td><td>{text(item.risk)}</td><td>{item.reasons?.join(' · ') || 'No browser-side structural warning observed; reputation was not queried.'}</td></tr>) : <tr><td colSpan="3">No URL was extracted.</td></tr>}</tbody></table></div>
        <h4 className="formal-subheading">Attachments / submitted files ({model.attachments.length})</h4>
        <div className="formal-table-wrap" tabIndex={0} role="region" aria-label="Scrollable evidence table"><table className="formal-table"><thead><tr><th>Filename / type</th><th>Size / entropy</th><th>Findings</th><th>SHA-256</th></tr></thead><tbody>{model.attachments.length ? model.attachments.map((item, index) => <tr key={`${item.filename}-${item.sha256}-${index}`}><td>{text(item.filename)}<br /><small>{text(item.detected_type)}</small></td><td>{formatBytes(item.size_bytes)}<br /><small>Entropy {text(item.entropy)}</small></td><td>{item.findings?.join(' ') || 'No static marker recorded; this is not a clean verdict.'}</td><td className="mono wrap-anywhere">{text(item.sha256)}</td></tr>) : <tr><td colSpan="4">No attachment was extracted or separately submitted.</td></tr>}</tbody></table></div>
      </ReportSection>

      <ReportSection number="07" title="REA deep-inspection record" subtitle="Optional morluto/rea provider evidence; unsupported and unavailable lanes remain explicit">
        <ReaSummary rea={model.rea} />
      </ReportSection>

      <ReportSection number="08" title="Analyst recommendations and limitations" subtitle="Manual review is required before operational or legal use">
        <h4 className="formal-subheading">Recommended handling</h4>
        <ol className="formal-list">{model.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ol>
        <h4 className="formal-subheading">Recorded limitations</h4>
        <ul className="formal-list">{model.limitations.length ? model.limitations.map((item, index) => <li key={index}>{item}</li>) : <li>No additional limitation text was recorded; absence of text does not remove the limits of automated static triage.</li>}</ul>
      </ReportSection>

      <ReportSection number="09" title="Legal-use and analyst-review record" subtitle="To be completed by the responsible human reviewer where required">
        <div className="formal-legal"><strong>Document status and legal-use notice</strong><p>{model.legalNote}</p></div>
        <DetailTable rows={model.reviewFields.map(([label, value]) => ({ label, value }))} />
        <div className="formal-signoff"><div><span>Analyst remarks</span><i /></div><div><span>Human signature / date (if separately authorised)</span><i /></div></div>
      </ReportSection>

      <footer className="formal-footer"><span>{model.documentNumber}</span><span>Generated from observed case data · verify against preserved original evidence</span><span>END OF WORKING REPORT</span></footer>
      {children ? <div className="formal-containment no-print">{children}</div> : null}
    </article>
  );
}
