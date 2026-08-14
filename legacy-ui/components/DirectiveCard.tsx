import React from 'react';
import { T3 } from '../theme';
import { Label, Risk } from './ui/Primitives';
import { Choice } from '../types';

const TYPE_LABELS: Record<Choice['type'], string> = {
  force: 'Force',
  diplomacy: 'Diplomacy',
  profit: 'Economy',
  innovation: 'Innovation',
};

interface DirectiveCardProps {
  choice: Choice;
  index: number;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  compact?: boolean;
}

export const DirectiveCard: React.FC<DirectiveCardProps> = ({
  choice, index, expanded, selected, onToggle, onSelect, compact = false,
}) => {
  const typeLabel = TYPE_LABELS[choice.type] || 'Directive';
  const letter = String.fromCharCode(65 + index);

  return (
    <div style={{
      background: selected ? T3.bg2 : T3.bg1,
      border: `1px solid ${selected ? T3.sig : T3.line1}`,
      borderRadius: T3.r3, overflow: 'hidden',
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
        }}
        aria-pressed={selected}
        aria-label={`Directive ${letter}: ${choice.text}. Risk ${choice.risk}, ${choice.forecastConfidence} confidence.`}
        style={{
          display: 'grid', gridTemplateColumns: compact ? '22px 1fr auto' : '28px 1fr auto',
          gap: compact ? T3.sp3 : T3.sp4,
          padding: compact ? T3.sp3 : `${T3.sp4} ${T3.sp4} ${T3.sp2}`,
          cursor: 'pointer', alignItems: 'start',
        }}
      >
        <div style={{
          width: 22, height: 22, display: 'grid', placeItems: 'center',
          background: selected ? T3.sig : T3.bg3, color: selected ? T3.bg0 : T3.fg2,
          fontFamily: T3.fontMono, fontSize: T3.s11, fontWeight: 600,
          borderRadius: T3.r1, marginTop: 2,
        }}>{letter}</div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp2, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600,
              letterSpacing: '0.14em', textTransform: 'uppercase', color: T3.fg2,
            }}>{typeLabel}</span>
            {compact && <><span style={{ color: T3.fg4 }}>·</span><Risk level={choice.risk} /></>}
          </div>
          <div style={{
            fontSize: compact ? T3.s14 : T3.s15, color: T3.fg0,
            lineHeight: 1.35, fontWeight: 500, letterSpacing: '-0.005em',
          }}>{choice.text}</div>
          {choice.projectedCost && (
            <div style={{
              fontSize: compact ? T3.s11 : T3.s12, color: T3.fg3,
              marginTop: 6, lineHeight: 1.45,
            }}>{choice.projectedCost}</div>
          )}
        </div>

        {!compact && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 6, minWidth: 110,
          }}>
            <Risk level={choice.risk} />
          </div>
        )}
      </div>

      {/* Meta bar — full-width row, Cost · Range · Confidence + Brief toggle */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr auto' : '28px 1fr auto',
        gap: compact ? T3.sp3 : T3.sp4,
        padding: compact
          ? `${T3.sp2} ${T3.sp3} ${T3.sp3}`
          : `${T3.sp2} ${T3.sp4} ${T3.sp3}`,
        borderTop: `1px solid ${T3.line1}`,
        alignItems: 'center',
      }}>
        {!compact && <div />}
        <div style={{
          display: 'flex', gap: T3.sp4, alignItems: 'center', flexWrap: 'wrap',
          fontFamily: T3.fontUI, fontSize: T3.s12,
        }}>
          <MetaKV k="Range" v={choice.forecastRange} mono />
          <MetaKV k="Confidence" v={choice.forecastConfidence} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          aria-expanded={expanded}
          style={{
            fontFamily: T3.fontUI, fontSize: T3.s12, fontWeight: 600, letterSpacing: '0.04em',
            background: 'transparent', border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
            padding: '6px 12px', color: T3.fg1, cursor: 'pointer',
          }}
        >{expanded ? '– Brief' : '+ Brief'}</button>
      </div>

      {expanded && (
        <div style={{
          padding: compact
            ? `${T3.sp3} ${T3.sp3} ${T3.sp3}`
            : `${T3.sp3} ${T3.sp4} ${T3.sp4} ${T3.sp4}`,
          marginLeft: compact ? 0 : 44,
          borderTop: `1px solid ${T3.line1}`,
          background: T3.bg1,
        }}>
          <p style={{
            fontFamily: T3.fontProse, fontSize: compact ? T3.s13 : T3.s14,
            lineHeight: 1.55, color: T3.fg1, margin: 0,
          }}>{choice.detailedDescription}</p>
          <div style={{
            borderLeft: `2px solid ${T3.line2}`, paddingLeft: T3.sp3, marginTop: T3.sp3,
          }}>
            <Label style={{ display: 'block', marginBottom: 4 }}>Technical Brief</Label>
            <p style={{
              fontFamily: T3.fontUI, fontSize: compact ? T3.s11 : T3.s12,
              lineHeight: 1.55, color: T3.fg2, margin: 0,
            }}>{choice.technicalReport}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const MetaKV: React.FC<{ k: string; v: string; mono?: boolean }> = ({ k, v, mono }) => (
  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
    <span style={{
      fontSize: T3.s10, color: T3.fg3, letterSpacing: '0.12em',
      textTransform: 'uppercase', fontWeight: 600,
    }}>{k}</span>
    <span style={{
      fontSize: T3.s12, color: T3.fg1,
      fontFamily: mono ? T3.fontMono : T3.fontUI,
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      maxWidth: 260,
    }}>{v}</span>
  </span>
);
