import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import { riskLabel, riskTone } from '../lib/workspaceUtils';

export function BrandMark({ size = 36 }) {
  return <img className="brand-mark-image" src="/spandr-mark.png" width={size} height={size} alt="" aria-hidden="true" />;
}

export function PageHeader({ eyebrow, title, description, actions, meta }) {
  return (
    <div className="page-heading">
      <div className="page-heading__copy">
        {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
        <div className="page-heading__title-row">
          <h1>{title}</h1>
          {meta}
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-heading__actions">{actions}</div> : null}
    </div>
  );
}

export function RiskBadge({ data, compact = false }) {
  const score = Number(data?.threat?.risk_score) || 0;
  const tone = riskTone(score);
  const Icon = tone === 'high' ? AlertTriangle : tone === 'medium' ? Info : CheckCircle2;
  return (
    <span className={`risk-badge risk-badge--${tone} ${compact ? 'risk-badge--compact' : ''}`}>
      <Icon size={compact ? 12 : 14} />
      {riskLabel(data)}
      {!compact ? <b>{score}/100</b> : null}
    </span>
  );
}

export function ScoreRing({ score = 0, size = 84 }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = riskTone(value);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={`score-ring score-ring--${tone}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={`Triage score ${value} out of 100`}>
        <circle className="score-ring__track" cx="50" cy="50" r={radius} fill="none" strokeWidth="8" />
        <circle
          className="score-ring__value"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle">{value}</text>
      </svg>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, secondary }) {
  return (
    <div className="ui-empty">
      {Icon ? <span className="ui-empty__icon"><Icon size={24} /></span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel ? (
        <button type="button" className="ui-button ui-button--primary" onClick={onAction}>
          {actionLabel}<ArrowRight size={15} />
        </button>
      ) : null}
      {secondary}
    </div>
  );
}

export function StatusLine({ tone = 'neutral', children }) {
  return <span className={`status-line status-line--${tone}`}><i />{children}</span>;
}

export function SectionTitle({ eyebrow, title, description, action }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow ? <span className="ui-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
