import React, { useEffect, useState } from 'react';
import { T3 } from '../theme';
import { Label, Delta } from './ui/Primitives';
import { HistoryEntry } from '../types';

interface JournalDrawerProps {
  history: HistoryEntry[];
  onClose: () => void;
}

export const JournalDrawer: React.FC<JournalDrawerProps> = ({ history, onClose }) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const past = history;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: T3.zModal,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
      }} />
      <aside style={{
        position: 'relative', width: 'min(440px, 100vw)', height: '100%',
        background: T3.bg1, borderLeft: `1px solid ${T3.line2}`,
        display: 'flex', flexDirection: 'column',
        fontFamily: T3.fontUI,
      }}>
        <header style={{
          padding: `${T3.sp4} ${T3.sp5}`, borderBottom: `1px solid ${T3.line1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <Label>Journal</Label>
            <div style={{
              fontSize: T3.s15, color: T3.fg0, fontWeight: 600, marginTop: 2,
            }}>{past.length} past {past.length === 1 ? 'turn' : 'turns'}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close journal"
            style={{
              background: 'transparent', border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
              padding: '4px 9px', color: T3.fg2, cursor: 'pointer', fontSize: T3.s12,
            }}
          >Close</button>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: T3.sp4 }}>
          {past.length === 0 && (
            <div style={{ fontSize: T3.s13, color: T3.fg3, padding: T3.sp4 }}>
              No past turns yet. Your history will fill in as you play.
            </div>
          )}
          {past.map(h => {
            const isOpen = expanded === h.turnNumber;
            const absDelta =
              Math.abs(h.statsDelta.stability) + Math.abs(h.statsDelta.wealth) +
              Math.abs(h.statsDelta.support) + Math.abs(h.statsDelta.primaryStatValue);
            const labels = h.manifestSnapshot.statsConfig;
            return (
              <article
                key={h.turnNumber}
                style={{ borderBottom: `1px solid ${T3.line1}`, padding: `${T3.sp3} 0` }}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : h.turnNumber)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    cursor: 'pointer', padding: 0, color: 'inherit',
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', gap: T3.sp3, alignItems: 'baseline',
                  }}>
                    <span style={{ fontFamily: T3.fontMono, fontSize: T3.s11, color: T3.fg3 }}>
                      T{String(h.turnNumber).padStart(2, '0')} · {h.year}
                    </span>
                    <span style={{
                      fontSize: T3.s11, color: absDelta > 0 ? T3.fg1 : T3.fg3,
                      fontFamily: T3.fontMono, fontVariantNumeric: 'tabular-nums',
                    }}>|Δ| {absDelta}</span>
                  </div>
                  <div style={{
                    fontFamily: T3.fontProse, fontSize: T3.s17, color: T3.fg0,
                    letterSpacing: '-0.01em', marginTop: 4,
                  }}>{h.eventTitle}</div>
                  {h.userChoice && (
                    <div style={{ fontSize: T3.s12, color: T3.fg2, marginTop: 4 }}>
                      <span style={{ color: T3.fg3 }}>→ </span>{h.userChoice}
                    </div>
                  )}
                </button>
                {isOpen && (
                  <div style={{ marginTop: T3.sp3, display: 'flex', flexDirection: 'column', gap: T3.sp2 }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: T3.sp3,
                    }}>
                      {[
                        [labels.stabilityLabel,   h.statsDelta.stability],
                        [labels.wealthLabel,      h.statsDelta.wealth],
                        [labels.supportLabel,     h.statsDelta.support],
                        [labels.primaryStatLabel, h.statsDelta.primaryStatValue],
                      ].map(([label, delta], i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        }}>
                          <span style={{
                            fontSize: T3.s10, color: T3.fg3,
                            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
                          }}>{label as string}</span>
                          <Delta value={delta as number} />
                        </div>
                      ))}
                    </div>
                    {h.statsReasoning && (
                      <p style={{
                        fontFamily: T3.fontProse, fontSize: T3.s13, lineHeight: 1.5,
                        color: T3.fg2, margin: `${T3.sp2} 0 0`,
                        fontStyle: 'italic',
                        borderLeft: `2px solid ${T3.line2}`, paddingLeft: T3.sp3,
                      }}>{h.statsReasoning}</p>
                    )}
                    <p style={{ fontFamily: T3.fontProse, fontSize: T3.s13, lineHeight: 1.5, color: T3.fg1, margin: 0 }}>{h.narrative}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
};
