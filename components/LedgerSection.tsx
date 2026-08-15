import React from 'react';
import { T3 } from '../theme';
import { Label } from './ui/Primitives';
import { Entity } from '../types';

interface LedgerSectionProps {
  title: string;
  entries: Entity[];
  negative?: boolean;
  showDescription?: boolean;
}

export const LedgerSection: React.FC<LedgerSectionProps> = ({
  title, entries, negative = false, showDescription = false,
}) => (
  <div>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      marginBottom: T3.sp2,
    }}>
      <Label>{title}</Label>
      <span style={{
        fontFamily: T3.fontMono, fontSize: T3.s10, color: T3.fg3,
        fontVariantNumeric: 'tabular-nums',
      }}>{entries.length}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((e, i) => (
        <div
          key={e.id}
          style={{
            padding: '6px 0',
            borderBottom: i < entries.length - 1 ? `1px solid ${T3.line1}` : 'none',
          }}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: T3.sp2,
          }}>
            <span style={{ fontSize: T3.s12, color: T3.fg1, letterSpacing: '-0.005em' }}>{e.name}</span>
            <span style={{
              fontFamily: T3.fontMono, fontSize: T3.s10,
              color: negative ? T3.neg : T3.fg2,
              fontVariantNumeric: 'tabular-nums',
            }}>{e.power ?? ''}</span>
          </div>
          <div style={{
            fontSize: T3.s10, color: T3.fg3, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginTop: 1,
          }}>
            {e.status ? `${e.type} · ${e.status}` : e.type}
          </div>
          {showDescription && (
            <div style={{ fontSize: T3.s11, color: T3.fg3, marginTop: 4, lineHeight: 1.4 }}>
              {e.description}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);
