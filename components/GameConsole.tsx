import React, { useEffect, useState, CSSProperties } from 'react';
import { T3 } from '../theme';
import { useMinWidth } from '../hooks/useBreakpoint';
import { Label, Chip, Delta, Gauge, Button, Speaker } from './ui/Primitives';
import { DirectiveCard } from './DirectiveCard';
import { LedgerSection } from './LedgerSection';
import { BottomSheet } from './BottomSheet';
import { TurnData, Choice } from '../types';

type CommitPayload = {
  choiceText: string;
  details: string | null;
  metadata: { risk: Choice['risk']; type: Choice['type'] | 'CUSTOM'; confidence: Choice['forecastConfidence'] } | null;
  isCustom: boolean;
};

interface GameConsoleProps {
  turn: TurnData;
  historyCount: number;
  revisionNotice?: string;
  onCommit: (payload: CommitPayload) => void;
  onOpenJournal: () => void;
  onOpenConsult: (advisorId?: string) => void;
  anyOverlayOpen: boolean;
}

export const GameConsole: React.FC<GameConsoleProps> = ({
  turn, historyCount, onCommit, onOpenJournal, onOpenConsult, anyOverlayOpen, revisionNotice,
}) => {
  const isLaptop = useMinWidth(1024);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [expandedChoiceId, setExpandedChoiceId] = useState<string | null>(null);
  const [customDirective, setCustomDirective] = useState('');
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [sheet, setSheet] = useState<'cabinet' | 'ledger' | null>(null);

  // Clear ephemeral selection state on turn change.
  useEffect(() => {
    setSelectedChoiceId(null);
    setExpandedChoiceId(null);
    setCustomDirective('');
    setNewsExpanded(false);
  }, [turn.turnNumber]);

  // Keyboard shortcuts — suppressed while any overlay is open.
  useEffect(() => {
    if (anyOverlayOpen) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      const idx = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      if (idx >= 0 && turn.choices[idx]) {
        setSelectedChoiceId(turn.choices[idx].id);
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        setSelectedChoiceId(null);
        setExpandedChoiceId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [turn.choices, anyOverlayOpen]);

  const statEntries = turn.metricDisplays.slice(0, 6).map((metric) => ({
    key: metric.id, label: metric.label, value: metric.value, display: metric.display,
    delta: metric.delta, confidence: metric.confidence, danger: metric.danger,
  }));

  const selectedChoice = turn.choices.find(c => c.id === selectedChoiceId) || null;

  const handleCommit = () => {
    if (selectedChoice) {
      onCommit({
        choiceText: selectedChoice.text,
        details: selectedChoice.technicalReport,
        metadata: {
          risk: selectedChoice.risk,
          type: selectedChoice.type,
          confidence: selectedChoice.forecastConfidence,
        },
        isCustom: false,
      });
    } else if (customDirective.trim()) {
      onCommit({
        choiceText: customDirective.trim(),
        details: null,
        metadata: null,
        isCustom: true,
      });
    }
  };

  const canCommit = !!selectedChoice || !!customDirective.trim();

  return isLaptop
    ? <Laptop
        turn={turn} statEntries={statEntries}
        selectedChoice={selectedChoice} selectedChoiceId={selectedChoiceId}
        expandedChoiceId={expandedChoiceId}
        customDirective={customDirective}
        newsExpanded={newsExpanded}
        onSelectChoice={setSelectedChoiceId}
        onToggleBrief={setExpandedChoiceId}
        onCustomChange={setCustomDirective}
        onToggleNews={() => setNewsExpanded(v => !v)}
        onCommit={handleCommit}
        canCommit={canCommit}
        onOpenJournal={onOpenJournal}
        onOpenConsult={() => onOpenConsult()}
        historyCount={historyCount}
      />
    : <Mobile
        turn={turn} statEntries={statEntries}
        selectedChoice={selectedChoice} selectedChoiceId={selectedChoiceId}
        expandedChoiceId={expandedChoiceId}
        customDirective={customDirective}
        newsExpanded={newsExpanded}
        onSelectChoice={setSelectedChoiceId}
        onToggleBrief={setExpandedChoiceId}
        onCustomChange={setCustomDirective}
        onToggleNews={() => setNewsExpanded(v => !v)}
        onCommit={handleCommit}
        canCommit={canCommit}
        sheet={sheet}
        onOpenSheet={setSheet}
        onOpenJournal={onOpenJournal}
        onOpenConsult={() => onOpenConsult()}
        historyCount={historyCount}
      />;
};

// ─── Laptop layout ─────────────────────────────────────────────────────
interface ViewProps {
  turn: TurnData;
  statEntries: Array<{ key: string; label: string; value: number; display: string; delta: number; confidence: string; danger: boolean }>;
  selectedChoice: Choice | null;
  selectedChoiceId: string | null;
  expandedChoiceId: string | null;
  customDirective: string;
  newsExpanded: boolean;
  onSelectChoice: (id: string | null) => void;
  onToggleBrief: (id: string | null) => void;
  onCustomChange: (v: string) => void;
  onToggleNews: () => void;
  onCommit: () => void;
  canCommit: boolean;
  onOpenJournal: () => void;
  onOpenConsult: () => void;
  historyCount: number;
  revisionNotice?: string;
}

const Laptop: React.FC<ViewProps> = ({
  turn, statEntries, selectedChoice, selectedChoiceId, expandedChoiceId,
  customDirective, newsExpanded,
  onSelectChoice, onToggleBrief, onCustomChange, onToggleNews, onCommit, canCommit,
  onOpenJournal, onOpenConsult, historyCount, revisionNotice,
}) => (
  <div style={{
    fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1,
    height: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr',
  }}>
    <header style={{
      borderBottom: `1px solid ${T3.line1}`, background: T3.bg1,
      padding: `${T3.sp3} ${T3.sp6}`,
      display: 'grid', gridTemplateColumns: 'minmax(190px, 0.7fr) minmax(360px, 1.2fr) minmax(440px, 1fr)', alignItems: 'center', gap: T3.sp5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp4, minWidth: 0 }}>
        <div style={{ width: 10, height: 10, background: T3.sig, borderRadius: 1 }} aria-hidden="true" />
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: T3.sp3, minWidth: 0 }}>
            <span style={{ fontSize: T3.s15, fontWeight: 600, color: T3.fg0, letterSpacing: '-0.01em' }}>Chronus</span>
            <span style={{ fontSize: T3.s12, color: T3.fg3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/ {turn.eventTitle}</span>
          </div>
          <div style={{
            fontSize: T3.s11, color: T3.fg3, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginTop: 2,
          }}>{turn.manifest.genre} · {turn.manifest.timeUnit}</div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: T3.sp6,
        paddingRight: T3.sp5, borderRight: `1px solid ${T3.line1}`, flexWrap: 'wrap', minWidth: 0,
      }}>
        <div>
          <Label>Turn</Label>
          <div style={{
            fontSize: T3.s19, fontWeight: 600, color: T3.fg0,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
          }}>
            {String(turn.turnNumber).padStart(2, '0')}
            <span style={{ color: T3.fg3, fontSize: T3.s13 }}> / {turn.currentGoal.totalTurns}</span>
          </div>
        </div>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <Label>Objective</Label>
          <div style={{ fontSize: T3.s13, color: T3.fg1, lineHeight: 1.35, marginTop: 2 }}>
            {turn.currentGoal.description}
          </div>
        </div>
        <Chip tone="sig">{turn.currentGoal.turnsRemaining} decision windows remain</Chip>
        {historyCount > 1 && (
          <button
            onClick={onOpenJournal}
            style={{
              fontFamily: T3.fontUI, fontSize: T3.s11, fontWeight: 600, letterSpacing: '0.06em',
              background: 'transparent', border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
              padding: '4px 10px', color: T3.fg2, cursor: 'pointer',
            }}
          >Journal ({historyCount}) →</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(90px, 1fr))', gap: `${T3.sp3} ${T3.sp5}`, minWidth: 0 }}>
        {statEntries.map(s => (
          <div key={s.key} style={{ minWidth: 0 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4,
            }}>
              <span style={{
                fontSize: T3.s10, color: T3.fg3, letterSpacing: '0.12em',
                textTransform: 'uppercase', fontWeight: 600,
              }}>{s.label}</span>
              <Delta value={s.delta} ariaLabel={`${s.label} changed by ${s.delta}`} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: T3.s19, fontWeight: 600, color: T3.fg0,
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>{s.display}</span>
              <span style={{ fontSize: T3.s11, color: T3.fg3 }}>/ 100</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <Gauge value={s.value} delta={s.delta} label={`${s.label} ${s.value} of 100`} />
            </div>
          </div>
        ))}
      </div>
    </header>

    <main style={{
      display: 'grid', gridTemplateColumns: '240px 1fr 320px',
      gap: 1, background: T3.line1, minHeight: 0,
    }}>
      {/* Left rail */}
      <aside style={{
        background: T3.bg0, overflow: 'auto', padding: T3.sp5,
        display: 'flex', flexDirection: 'column', gap: T3.sp5,
      }}>
        <div>
          <Label>Pressure Arcs</Label>
          <div style={{ marginTop: T3.sp3, display: 'flex', flexDirection: 'column', gap: T3.sp3 }}>
            {turn.arcs.map(a => (
              <div key={a.id}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  marginBottom: 3,
                }}>
                  <span style={{ fontSize: T3.s12, color: T3.fg1, letterSpacing: '-0.005em' }}>{a.title}</span>
                  <span style={{
                    fontSize: T3.s10, color: T3.fg3, fontVariantNumeric: 'tabular-nums',
                  }}>{a.currentValue}</span>
                </div>
                <div style={{ height: 2, background: T3.bg3, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${a.currentValue}%`, background: T3.fg2,
                  }} />
                </div>
                <div style={{
                  fontSize: T3.s10, color: T3.fg3, marginTop: 3,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{a.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: T3.line1 }} />

        <LedgerSection title="Allies" entries={turn.ledger.allies} />
        <LedgerSection title="Assets" entries={turn.ledger.assets} />
        <LedgerSection title="Threats" entries={turn.ledger.enemies} negative />
      </aside>

      {/* Center */}
      <section style={{
        background: T3.bg0, overflow: 'auto',
        padding: `${T3.sp7} ${T3.sp8}`,
        display: 'flex', flexDirection: 'column', gap: T3.sp7,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: T3.sp4, marginBottom: T3.sp2 }}>
            <span style={{
              fontSize: T3.s12, color: T3.fg3, letterSpacing: '0.14em',
              textTransform: 'uppercase', fontWeight: 600,
            }}>Situation Report · {turn.year}</span>
          </div>
          <h1 style={{
            fontFamily: T3.fontProse, fontSize: T3.s40, fontWeight: 400,
            lineHeight: 1.1, color: T3.fg0, margin: 0,
            letterSpacing: '-0.02em', textWrap: 'balance' as any,
          }}>{turn.eventTitle}</h1>
        </div>

        <article style={{
          fontFamily: T3.fontProse, fontSize: T3.s19, lineHeight: 1.55,
          color: T3.fg1, maxWidth: '68ch', textWrap: 'pretty' as any,
        }}>
          {turn.narrative.split('\n\n').map((para, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : `${T3.sp4} 0 0`,
              fontWeight: i === 0 ? 500 : 400,
              color: i === 0 ? T3.fg0 : T3.fg1,
            }}>{para}</p>
          ))}
        </article>

        <NarrativeDepth turn={turn} />
        <CausalChanges turn={turn} />

        {turn.news.length > 0 && (
          <div style={{
            borderTop: `1px solid ${T3.line1}`, borderBottom: `1px solid ${T3.line1}`,
            padding: `${T3.sp3} 0`, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: T3.sp3, marginBottom: 4,
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: T3.sp3 }}>
                <Label>Wires</Label>
                <span style={{ fontSize: T3.s10, color: T3.fg3 }}>{turn.news.length} incoming</span>
              </div>
              {turn.news.length > 3 && (
                <button
                  onClick={onToggleNews}
                  style={{
                    fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'transparent', border: 'none',
                    color: T3.fg2, cursor: 'pointer', padding: 0,
                  }}
                >{newsExpanded ? 'Collapse' : `+ ${turn.news.length - 3} more`}</button>
              )}
            </div>
            {(newsExpanded ? turn.news : turn.news.slice(0, 3)).map((n, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '96px 1fr', gap: T3.sp3, fontSize: T3.s12,
              }}>
                <span title={n.source} style={{
                  color: T3.fg3, letterSpacing: '0.04em',
                  fontFamily: T3.fontMono, fontSize: T3.s11,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{n.source}</span>
                <span style={{ color: T3.fg1 }}>{n.headline}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: T3.sp4, flexWrap: 'wrap', gap: T3.sp2,
          }}>
            <div>
              <Label>Directives</Label>
              <h2 style={{
                fontFamily: T3.fontProse, fontSize: T3.s28, fontWeight: 400,
                color: T3.fg0, margin: `4px 0 0`, letterSpacing: '-0.015em',
              }}>{turn.choices.length} options on the table.</h2>
            </div>
            <span style={{ fontSize: T3.s11, color: T3.fg3 }}>
              Press A–{String.fromCharCode(64 + turn.choices.length)} · Esc to clear
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: T3.sp3 }}>
            {turn.choices.map((c, i) => (
              <DirectiveCard
                key={c.id}
                choice={c}
                index={i}
                expanded={expandedChoiceId === c.id}
                selected={selectedChoiceId === c.id}
                onToggle={() => onToggleBrief(expandedChoiceId === c.id ? null : c.id)}
                onSelect={() => onSelectChoice(c.id)}
              />
            ))}

            <CustomDirectiveInput
              value={customDirective}
              onChange={onCustomChange}
              disabled={!!selectedChoiceId}
              notice={revisionNotice}
            />
          </div>

          <div style={{
            marginTop: T3.sp5,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: T3.sp4, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: T3.s12, color: T3.fg3, minWidth: 0 }}>
              {selectedChoice
                ? <>Selected: <span style={{ color: T3.fg1 }}>{selectedChoice.text}</span></>
                : customDirective.trim()
                  ? <>Custom directive drafted · {customDirective.trim().split(/\s+/).length} words</>
                  : `Select a directive (A–${String.fromCharCode(64 + turn.choices.length)}) or draft your own.`}
            </div>
            <div style={{ display: 'flex', gap: T3.sp2 }}>
              <Button onClick={onOpenConsult}>Consult Cabinet</Button>
              <Button
                primary
                disabled={!canCommit}
                onConfirm={onCommit}
                confirmLabel="Commit now"
              >Commit Directive →</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Right rail */}
      <aside style={{
        background: T3.bg1, overflow: 'auto', padding: T3.sp5,
        display: 'flex', flexDirection: 'column', gap: T3.sp5,
      }}>
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: T3.sp3,
          }}>
            <Label>Cabinet · {turn.advisors.length}</Label>
            <span style={{
              fontSize: T3.s10, color: T3.fg3,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Bias marked</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: T3.sp2 }}>
            {turn.advisors.map(a => (
              <Speaker
                key={a.id}
                name={a.name}
                role={a.role}
                bias={a.bias}
                status={a.status}
                onConsult={() => onOpenConsult()}
              >{a.advice}</Speaker>
            ))}
          </div>
        </div>

        <div>
          <Label>Analyst Note</Label>
          <p style={{
            fontFamily: T3.fontProse, fontSize: T3.s13, lineHeight: 1.5, color: T3.fg2,
            margin: `${T3.sp2} 0 0`, fontStyle: 'italic',
            borderLeft: `2px solid ${T3.line2}`, paddingLeft: T3.sp3,
          }}>{turn.statsReasoning}</p>
        </div>
      </aside>
    </main>
  </div>
);

// ─── Mobile layout ─────────────────────────────────────────────────────
interface MobileProps extends ViewProps {
  sheet: 'cabinet' | 'ledger' | null;
  onOpenSheet: (s: 'cabinet' | 'ledger' | null) => void;
}

const Mobile: React.FC<MobileProps> = ({
  turn, statEntries, selectedChoice, selectedChoiceId, expandedChoiceId,
  customDirective, newsExpanded,
  onSelectChoice, onToggleBrief, onCustomChange, onToggleNews, onCommit, canCommit,
  sheet, onOpenSheet, onOpenJournal, onOpenConsult, historyCount, revisionNotice,
}) => (
  <div style={{
    fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1,
    minHeight: '100vh', position: 'relative',
    display: 'flex', flexDirection: 'column',
  }}>
    <div style={{
      padding: `${T3.sp4} ${T3.sp5} ${T3.sp3}`,
      borderBottom: `1px solid ${T3.line1}`, background: T3.bg1,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: T3.sp3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp2 }}>
          <div style={{ width: 6, height: 6, background: T3.sig, borderRadius: 1 }} aria-hidden="true" />
          <span style={{ fontSize: T3.s13, fontWeight: 600, color: T3.fg0 }}>Chronus</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {historyCount > 1 && (
            <button
              onClick={onOpenJournal}
              aria-label="Open journal of past turns"
              style={{
                fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'transparent', border: `1px solid ${T3.line2}`,
                borderRadius: T3.r1, padding: '3px 7px', color: T3.fg2, cursor: 'pointer',
              }}
            >Journal</button>
          )}
          <Chip tone="sig">
            T{String(turn.turnNumber).padStart(2, '0')} / {turn.currentGoal.totalTurns}
          </Chip>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: T3.sp3 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Label>Objective</Label>
          <div style={{
            fontSize: T3.s13, color: T3.fg1, marginTop: 3, lineHeight: 1.35,
          }}>{turn.currentGoal.description}</div>
        </div>
        <span style={{
          fontSize: T3.s11, color: T3.sig, fontFamily: T3.fontMono,
          whiteSpace: 'nowrap', paddingTop: 14,
        }}>
          {turn.currentGoal.turnsRemaining} windows left
        </span>
      </div>
    </div>

    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: T3.sp3,
      padding: `${T3.sp3} ${T3.sp5}`, borderBottom: `1px solid ${T3.line1}`, background: T3.bg1,
    }}>
      {statEntries.map(s => (
        <div key={s.key}>
          <div style={{
            fontSize: T3.s10, color: T3.fg3, letterSpacing: '0.1em',
            textTransform: 'uppercase', fontWeight: 600, marginBottom: 2,
          }}>{s.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{
              fontSize: T3.s17, fontWeight: 600, color: T3.fg0,
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>{s.display}</span>
            <span style={{ fontSize: T3.s11, color: T3.fg3 }}>/100</span>
          </div>
          <div style={{ marginTop: 3 }}>
            <Gauge value={s.value} delta={s.delta} label={`${s.label} ${s.value} of 100`} />
          </div>
          <div style={{ marginTop: 3 }}><Delta value={s.delta} /></div>
        </div>
      ))}
    </div>

    <div style={{ flex: 1, overflow: 'auto' }}>
      <section style={{ padding: `${T3.sp6} ${T3.sp5}` }}>
        <div style={{
          fontSize: T3.s10, color: T3.fg3, letterSpacing: '0.14em',
          textTransform: 'uppercase', fontWeight: 600,
        }}>Situation · {turn.year}</div>
        <h1 style={{
          fontFamily: T3.fontProse, fontSize: T3.s28, fontWeight: 400,
          lineHeight: 1.15, color: T3.fg0,
          margin: `${T3.sp2} 0 ${T3.sp4}`,
          letterSpacing: '-0.015em', textWrap: 'balance' as any,
        }}>{turn.eventTitle}</h1>
        <article style={{
          fontFamily: T3.fontProse, fontSize: T3.s15, lineHeight: 1.55,
          color: T3.fg1, textWrap: 'pretty' as any,
        }}>
          {turn.narrative.split('\n\n').map((p, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : `${T3.sp3} 0 0`,
              color: i === 0 ? T3.fg0 : T3.fg1, fontWeight: i === 0 ? 500 : 400,
            }}>{p}</p>
          ))}
        </article>
        <NarrativeDepth turn={turn} />
        <CausalChanges turn={turn} />
      </section>

      {turn.news.length > 0 && (
        <section style={{ padding: `0 ${T3.sp5}`, marginBottom: T3.sp5 }}>
          <div style={{
            borderTop: `1px solid ${T3.line1}`, borderBottom: `1px solid ${T3.line1}`,
            padding: `${T3.sp3} 0`,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <Label>Wires · {turn.news.length}</Label>
              {turn.news.length > 3 && (
                <button
                  onClick={onToggleNews}
                  style={{
                    fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'transparent', border: 'none',
                    color: T3.fg2, cursor: 'pointer', padding: 0,
                  }}
                >{newsExpanded ? 'Collapse' : `+ ${turn.news.length - 3} more`}</button>
              )}
            </div>
            <div style={{ marginTop: T3.sp2, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(newsExpanded ? turn.news : turn.news.slice(0, 3)).map((n, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '78px 1fr', gap: T3.sp3,
                }}>
                  <span title={n.source} style={{
                    fontSize: T3.s11, color: T3.fg3, fontFamily: T3.fontMono,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{n.source}</span>
                  <span style={{ fontSize: T3.s12, color: T3.fg1, lineHeight: 1.35 }}>
                    {n.headline}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section style={{ padding: `${T3.sp2} ${T3.sp5} ${T3.sp6}` }}>
        <Label>Directives</Label>
        <h2 style={{
          fontFamily: T3.fontProse, fontSize: T3.s22, fontWeight: 400,
          color: T3.fg0, margin: `4px 0 ${T3.sp4}`, letterSpacing: '-0.01em',
        }}>{turn.choices.length} options on the table.</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: T3.sp3 }}>
          {turn.choices.map((c, i) => (
            <DirectiveCard
              key={c.id}
              choice={c}
              index={i}
              expanded={expandedChoiceId === c.id}
              selected={selectedChoiceId === c.id}
              onToggle={() => onToggleBrief(expandedChoiceId === c.id ? null : c.id)}
              onSelect={() => onSelectChoice(c.id)}
              compact
            />
          ))}

          <CustomDirectiveInput
            value={customDirective}
            onChange={onCustomChange}
            disabled={!!selectedChoiceId}
            compact
            notice={revisionNotice}
          />
        </div>
      </section>

      <section style={{
        padding: `0 ${T3.sp5} ${T3.sp6}`,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T3.sp3,
      }}>
        <button onClick={() => onOpenSheet('cabinet')} style={quickNavStyle}>
          <Label style={{ display: 'block', marginBottom: 2 }}>Cabinet</Label>
          <span style={{ fontSize: T3.s12, color: T3.fg1 }}>
            {turn.advisors.length} advisors, biased
          </span>
        </button>
        <button onClick={() => onOpenSheet('ledger')} style={quickNavStyle}>
          <Label style={{ display: 'block', marginBottom: 2 }}>Ledger</Label>
          <span style={{ fontSize: T3.s12, color: T3.fg1 }}>
            {turn.ledger.allies.length} allies · {turn.ledger.enemies.length} threats
          </span>
        </button>
      </section>
    </div>

    {/* Sticky commit bar */}
    <div style={{
      borderTop: `1px solid ${T3.line1}`, background: T3.bg1,
      padding: `${T3.sp3} ${T3.sp5}`,
      display: 'flex', gap: T3.sp2, alignItems: 'center',
      position: 'sticky', bottom: 0, zIndex: T3.zSticky,
    }}>
      <div style={{
        flex: 1, fontSize: T3.s11, color: T3.fg3, lineHeight: 1.3,
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
      }}>
        {selectedChoice
          ? selectedChoice.text
          : customDirective.trim()
            ? 'Custom directive drafted'
            : 'Select a directive.'}
      </div>
      <Button
        primary
        disabled={!canCommit}
        onConfirm={onCommit}
        confirmLabel="Commit"
        style={{ padding: '10px 14px', fontSize: T3.s12 }}
      >Commit →</Button>
    </div>

    {sheet && (
      <BottomSheet onClose={() => onOpenSheet(null)}>
        {sheet === 'cabinet' && (
          <>
            <Label>Cabinet · {turn.advisors.length}</Label>
            <div style={{
              marginTop: T3.sp3, display: 'flex', flexDirection: 'column', gap: T3.sp2,
            }}>
              {turn.advisors.map(a => (
                <Speaker
                  key={a.id}
                  name={a.name}
                  role={a.role}
                  bias={a.bias}
                  status={a.status}
                  onConsult={() => { onOpenSheet(null); onOpenConsult(); }}
                >{a.advice}</Speaker>
              ))}
            </div>
          </>
        )}
        {sheet === 'ledger' && (
          <>
            <Label>World Ledger</Label>
            <div style={{
              marginTop: T3.sp3, display: 'flex', flexDirection: 'column', gap: T3.sp5,
            }}>
              <LedgerSection title="Allies" entries={turn.ledger.allies} showDescription />
              <LedgerSection title="Assets" entries={turn.ledger.assets} showDescription />
              <LedgerSection title="Threats" entries={turn.ledger.enemies} negative showDescription />
            </div>
            <div style={{ marginTop: T3.sp5 }}>
              <Label>Pressure Arcs</Label>
              <div style={{
                marginTop: T3.sp3, display: 'flex', flexDirection: 'column', gap: T3.sp3,
              }}>
                {turn.arcs.map(a => (
                  <div key={a.id}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                      marginBottom: 3,
                    }}>
                      <span style={{ fontSize: T3.s13, color: T3.fg1 }}>{a.title}</span>
                      <span style={{
                        fontSize: T3.s11, color: T3.fg3, fontFamily: T3.fontMono,
                      }}>{a.currentValue}/100</span>
                    </div>
                    <div style={{ height: 2, background: T3.bg3, position: 'relative' }}>
                      <div style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${a.currentValue}%`, background: T3.fg2,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </BottomSheet>
    )}
  </div>
);

const NarrativeDepth: React.FC<{ turn: TurnData }> = ({ turn }) => {
  if (!turn.detailedReport && !turn.pressCoverage?.length && !turn.advisorReactions?.length) return null;
  return <details style={{ border: `1px solid ${T3.line1}`, borderRadius: T3.r3, padding: T3.sp4, background: T3.bg1 }}>
    <summary style={{ color: T3.fg1, cursor: 'pointer', fontSize: T3.s12, fontWeight: 600 }}>Open full situation report</summary>
    {turn.detailedReport && <p style={{ fontFamily: T3.fontProse, fontSize: T3.s14, lineHeight: 1.6, color: T3.fg1, whiteSpace: 'pre-wrap' }}>{turn.detailedReport}</p>}
    {turn.advisorReactions?.map((reaction) => <blockquote key={`${reaction.actorId}-${reaction.name}`} style={{ borderLeft: `2px solid ${T3.sigLine}`, margin: `${T3.sp3} 0`, paddingLeft: T3.sp3, fontFamily: T3.fontProse, color: T3.fg2 }}><strong style={{ color: T3.fg0 }}>{reaction.name}:</strong> {reaction.reaction}</blockquote>)}
    {turn.pressCoverage?.map((item) => <article key={`${item.source}-${item.headline}`} style={{ borderTop: `1px solid ${T3.line1}`, paddingTop: T3.sp3, marginTop: T3.sp3 }}><Label>{item.source}</Label><div style={{ color: T3.fg0, marginTop: 3 }}>{item.headline}</div><p style={{ color: T3.fg2, fontSize: T3.s12, lineHeight: 1.5 }}>{item.body}</p></article>)}
  </details>;
};

const CausalChanges: React.FC<{ turn: TurnData }> = ({ turn }) => {
  if (!turn.developments?.length) return null;
  return <section style={{ borderLeft: `3px solid ${T3.sig}`, paddingLeft: T3.sp4 }}>
    <Label tone="sig">Causal ledger · observable changes</Label>
    <div style={{ marginTop: T3.sp2, display: 'flex', flexDirection: 'column', gap: T3.sp2 }}>
      {turn.developments.map((change) => <div key={change.id} style={{ fontSize: T3.s12, color: T3.fg2 }}>
        <strong style={{ color: T3.fg0 }}>{change.label}</strong> · {String(change.before)} → {String(change.after)}
        <div style={{ color: T3.fg3, marginTop: 2 }}>{change.cause}</div>
      </div>)}
    </div>
  </section>;
};

const quickNavStyle: CSSProperties = {
  textAlign: 'left',
  padding: `${T3.sp3} ${T3.sp4}`,
  background: T3.bg1,
  border: `1px solid ${T3.line1}`,
  borderRadius: T3.r3,
  cursor: 'pointer',
  color: T3.fg1,
};

// ─── Custom directive input ───────────────────────────────────────────
const CustomDirectiveInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  compact?: boolean;
  notice?: string;
}> = ({ value, onChange, disabled, compact = false, notice }) => (
  <div style={{
    border: `1px dashed ${T3.line2}`, borderRadius: T3.r3,
    padding: compact ? T3.sp3 : T3.sp4,
    background: T3.bg1, opacity: disabled ? 0.55 : 1,
    display: 'grid',
    gridTemplateColumns: compact ? '1fr' : '28px 1fr auto',
    gap: T3.sp4,
  }}>
    {!compact && (
      <div style={{
        width: 22, height: 22, display: 'grid', placeItems: 'center',
        background: T3.bg3, color: T3.fg2,
        fontFamily: T3.fontMono, fontSize: T3.s11, fontWeight: 600,
        borderRadius: T3.r1, marginTop: 2,
      }}>+</div>
    )}
    <div style={{ minWidth: 0 }}>
      {notice && (
        <div role="alert" style={{
          marginBottom: T3.sp3, padding: `${T3.sp2}px ${T3.sp3}px`,
          background: T3.sigBg, border: `1px solid ${T3.sigLine}`, borderRadius: T3.r2,
          color: T3.fg1, fontSize: T3.s12, lineHeight: 1.5,
        }}>
          <span style={{ color: T3.sig, fontWeight: 600, marginRight: 6 }}>Revise directive —</span>
          {notice} No turn was consumed.
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp2, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T3.fg2,
        }}>Custom Directive</span>
        <span style={{ color: T3.fg4 }}>·</span>
        <span style={{ fontSize: T3.s11, color: T3.fg3 }}>
          Risk will be assessed on commit
        </span>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Draft your own order…"
        style={{
          fontFamily: T3.fontProse, fontSize: T3.s15, lineHeight: 1.5,
          color: T3.fg0, background: 'transparent', border: 'none', outline: 'none',
          resize: 'vertical', minHeight: 48, width: '100%',
        }}
      />
    </div>
    {!compact && (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, minWidth: 110,
      }}>
        <span style={{
          fontFamily: T3.fontUI, fontSize: T3.s10, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: T3.fg3,
          border: `1px dashed ${T3.line2}`, padding: '3px 6px', borderRadius: T3.r1,
        }}>Deferred Assessment</span>
        <span style={{
          fontSize: T3.s10, color: T3.fg3,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>Scored after commit</span>
      </div>
    )}
  </div>
);
