import React, { useEffect, useState, CSSProperties, PropsWithChildren, ReactNode } from 'react';
import { T3, AdvisorBias } from '../../theme';

type Tone = 'fg0' | 'fg1' | 'fg2' | 'fg3' | 'fg4' | 'sig' | 'pos' | 'neg';

export const Label: React.FC<{ children: ReactNode; style?: CSSProperties; tone?: Tone }> = ({
  children, style, tone = 'fg3',
}) => (
  <span style={{
    fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600,
    letterSpacing: '0.14em', textTransform: 'uppercase',
    color: (T3 as any)[tone] ?? T3.fg3,
    ...style,
  }}>{children}</span>
);

export const Panel: React.FC<PropsWithChildren<{
  title?: ReactNode; aside?: ReactNode; pad?: string; style?: CSSProperties;
}>> = ({ children, title, aside, pad = T3.sp5, style }) => (
  <section style={{
    background: T3.bg1, border: `1px solid ${T3.line1}`, borderRadius: T3.r3,
    display: 'flex', flexDirection: 'column', ...style,
  }}>
    {(title || aside) && (
      <header style={{
        padding: `${T3.sp3} ${pad}`, borderBottom: `1px solid ${T3.line1}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: T3.sp3,
      }}>
        {typeof title === 'string' ? <Label>{title}</Label> : title}
        {aside && <div style={{ display: 'flex', gap: T3.sp2, alignItems: 'center' }}>{aside}</div>}
      </header>
    )}
    <div style={{ padding: pad, flex: 1, minHeight: 0 }}>{children}</div>
  </section>
);

type ChipTone = 'neutral' | 'sig' | 'pos' | 'neg' | 'warn';
export const Chip: React.FC<PropsWithChildren<{ tone?: ChipTone; style?: CSSProperties }>> = ({
  children, tone = 'neutral', style,
}) => {
  const tones: Record<ChipTone, { bg: string; fg: string; border: string }> = {
    neutral: { bg: T3.bg3, fg: T3.fg2, border: T3.line1 },
    sig:     { bg: T3.sigBg, fg: T3.sig, border: T3.sigLine },
    pos:     { bg: 'oklch(0.35 0.08 160 / 0.2)', fg: T3.pos, border: 'oklch(0.5 0.1 160 / 0.4)' },
    neg:     { bg: 'oklch(0.35 0.10 25 / 0.2)',  fg: T3.neg, border: 'oklch(0.5 0.12 25 / 0.4)' },
    warn:    { bg: 'oklch(0.32 0.08 60 / 0.18)', fg: 'oklch(0.80 0.11 60)', border: 'oklch(0.5 0.11 60 / 0.4)' },
  };
  const c = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px',
      fontFamily: T3.fontUI, fontSize: T3.s11, fontWeight: 600,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: c.fg, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: T3.r1, fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
};

export const Delta: React.FC<{ value: number | null | undefined; unit?: string; ariaLabel?: string }> = ({
  value, unit = '', ariaLabel,
}) => {
  if (value === 0 || value == null) {
    return (
      <span aria-label={ariaLabel || 'No change'} style={{
        color: T3.fg3, fontFamily: T3.fontUI, fontSize: T3.s12, fontVariantNumeric: 'tabular-nums',
      }}>— 0</span>
    );
  }
  const positive = value > 0;
  const label = ariaLabel || `${positive ? 'increased by' : 'decreased by'} ${Math.abs(value)}${unit ? ' ' + unit : ''}`;
  return (
    <span aria-label={label} style={{
      color: positive ? T3.pos : T3.neg,
      fontFamily: T3.fontUI, fontSize: T3.s12, fontWeight: 600,
      fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
    }}>
      {positive ? '▲' : '▼'} {positive ? '+' : ''}{value}{unit}
    </span>
  );
};

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
export const Risk: React.FC<{ level: RiskLevel }> = ({ level }) => {
  const levels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];
  const fills = [T3.riskLow, T3.risk2, T3.risk3, T3.risk4];
  const idx = levels.indexOf(level);
  const fill = idx >= 0 ? fills[idx] : T3.riskLow;
  return (
    <span aria-label={`Risk level: ${level}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: T3.fontUI,
    }}>
      <span style={{ display: 'inline-flex', gap: 2 }} aria-hidden="true">
        {levels.map((_, i) => (
          <span key={i} style={{
            width: 4, height: 10,
            background: i <= idx ? fill : T3.bg4,
          }} />
        ))}
      </span>
      <span style={{
        fontSize: T3.s11, fontWeight: 600, letterSpacing: '0.1em', color: T3.fg2,
      }}>{level}</span>
    </span>
  );
};

export const Gauge: React.FC<{
  value: number; delta?: number; threshold?: number; width?: string; label?: string;
}> = ({ value, delta, threshold, width = '100%', label }) => {
  const pct = Math.max(0, Math.min(100, value));
  const prev = pct - (delta || 0);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || `Gauge at ${pct} of 100`}
      style={{ width, position: 'relative', height: 4, background: T3.bg3, borderRadius: 1 }}
    >
      {delta != null && delta !== 0 && (
        <div aria-hidden="true" style={{
          position: 'absolute', left: `${Math.max(0, Math.min(100, prev))}%`, top: -2, bottom: -2, width: 1,
          background: T3.fg4,
        }} />
      )}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
        background: T3.fg1, borderRadius: 1,
      }} />
      {threshold != null && (
        <div aria-hidden="true" style={{
          position: 'absolute', left: `${threshold}%`, top: -3, bottom: -3, width: 1, background: T3.sig,
        }} />
      )}
    </div>
  );
};

export const Button: React.FC<PropsWithChildren<{
  primary?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: CSSProperties;
  disabled?: boolean;
  confirmLabel?: string;
  onConfirm?: () => void;
  ariaLabel?: string;
  type?: 'button' | 'submit';
}>> = ({
  children, primary = false, onClick, style, disabled = false,
  confirmLabel, onConfirm, ariaLabel, type = 'button',
}) => {
  const [confirming, setConfirming] = useState(false);

  const base: CSSProperties = {
    fontFamily: T3.fontUI, fontSize: T3.s13, fontWeight: 600, letterSpacing: '0.04em',
    padding: `9px 16px`, borderRadius: T3.r2,
    border: `1px solid ${primary ? T3.sig : T3.line2}`,
    background: primary ? T3.sig : T3.bg3,
    color: primary ? T3.bg0 : T3.fg1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    outline: 'none',
  };

  if (onConfirm && confirming) {
    return (
      <span style={{ display: 'inline-flex', gap: T3.sp2, alignItems: 'center' }}>
        <span style={{ fontSize: T3.s12, color: T3.fg2 }}>Confirm?</span>
        <button
          type="button"
          onClick={() => { setConfirming(false); onConfirm(); }}
          style={{ ...base, background: T3.sig, color: T3.bg0, borderColor: T3.sig }}
        >
          {confirmLabel || 'Commit now'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{ ...base, fontSize: T3.s12, padding: '7px 12px' }}
        >Cancel</button>
      </span>
    );
  }

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={e => {
        if (disabled) return;
        if (onConfirm) { setConfirming(true); return; }
        onClick?.(e);
      }}
      disabled={disabled}
      style={{ ...base, ...style }}
    >{children}</button>
  );
};

type SpeakerStatus = 'Active' | 'Compromised' | 'Deceased' | string;
export const Speaker: React.FC<{
  name: string; role: string; bias: AdvisorBias | string; status?: SpeakerStatus;
  children?: ReactNode; onConsult?: () => void;
}> = ({ name, role, bias, status = 'Active', children, onConsult }) => {
  const biasColor = (T3 as any)[bias] || T3.fg3;
  const compromised = status === 'Compromised';
  const deceased = status === 'Deceased';

  return (
    <div
      aria-disabled={deceased}
      style={{
        display: 'grid', gridTemplateColumns: '3px 1fr',
        background: T3.bg2, borderRadius: T3.r2, overflow: 'hidden',
        opacity: deceased ? 0.55 : compromised ? 0.85 : 1,
        filter: deceased ? 'grayscale(1)' : compromised ? 'saturate(0.45)' : 'none',
        position: 'relative',
      }}
    >
      <div style={{ background: deceased ? T3.fg4 : biasColor }} />
      <div style={{ padding: `${T3.sp3} ${T3.sp4}` }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: T3.sp2, marginBottom: 2,
        }}>
          <span style={{
            fontFamily: T3.fontUI, fontSize: T3.s13, fontWeight: 600, color: T3.fg0,
            letterSpacing: '-0.005em',
            textDecoration: deceased ? 'line-through' : 'none',
          }}>{name}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {compromised && <Chip tone="warn" style={{ fontSize: 10, padding: '1px 5px' }}>Compromised</Chip>}
            {deceased && <Chip tone="neg" style={{ fontSize: 10, padding: '1px 5px' }}>Deceased</Chip>}
            <span style={{
              fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: deceased ? T3.fg3 : biasColor,
            }}>{bias}</span>
          </div>
        </div>
        <div style={{
          fontFamily: T3.fontUI, fontSize: T3.s11, color: T3.fg3,
          marginBottom: T3.sp2, letterSpacing: '0.02em',
        }}>{role}</div>
        <p style={{
          fontFamily: T3.fontProse, fontSize: T3.s14, lineHeight: 1.5,
          color: deceased ? T3.fg3 : T3.fg1, margin: 0, fontStyle: 'italic',
          textWrap: 'pretty' as any,
        }}>
          {deceased
            ? <span style={{ color: T3.fg3 }}>— No longer advising. —</span>
            : <>&ldquo;{children}&rdquo;</>}
        </p>
        {!deceased && onConsult && (
          <button
            onClick={onConsult}
            style={{
              marginTop: T3.sp2, fontFamily: T3.fontUI, fontSize: T3.s11, fontWeight: 600,
              letterSpacing: '0.06em', background: 'transparent',
              border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
              padding: '3px 8px', color: T3.fg2, cursor: 'pointer',
            }}
          >Consult →</button>
        )}
      </div>
    </div>
  );
};
