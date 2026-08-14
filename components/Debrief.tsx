import React from 'react';
import { T3 } from '../theme';
import { useMinWidth } from '../hooks/useBreakpoint';
import { Label, Delta, Gauge, Button } from './ui/Primitives';
import { TurnData, HistoryEntry } from '../types';
import { Campaign } from '../engine/domain';
import { playerVisibleState } from '../engine/projections';

interface DebriefProps {
  result: NonNullable<TurnData['goalResult']>;
  history: HistoryEntry[];
  finalTurn: TurnData;
  onReplay: () => void;
  onNewScenario: () => void;
  onContinue?: () => void;         // continue to next goal (when game isn't over)
  hasNextGoal: boolean;
  campaign?: Campaign;
}

function computeTurningPoints(history: HistoryEntry[]) {
  return [...history]
    .map(h => ({
      ...h,
      absDelta:
        Math.abs(h.statsDelta.stability) +
        Math.abs(h.statsDelta.wealth) +
        Math.abs(h.statsDelta.support) +
        Math.abs(h.statsDelta.primaryStatValue),
      totalDelta:
        h.statsDelta.stability + h.statsDelta.wealth +
        h.statsDelta.support + h.statsDelta.primaryStatValue,
    }))
    .sort((a, b) => b.absDelta - a.absDelta)
    .slice(0, 4)
    .sort((a, b) => a.turnNumber - b.turnNumber);
}

function computeStats(history: HistoryEntry[]) {
  const directives = history.filter(h => !!h.userChoice).length;
  const customOrders = history.filter(h =>
    h.executionAnalysis?.directiveType === 'CUSTOM'
  ).length;
  const criticalSuccesses = history.filter(h =>
    h.executionAnalysis?.outcomeCategory === 'VICTORY'
  ).length;
  return {
    turnsPlayed: history.length,
    directives,
    customOrders,
    criticalSuccesses,
  };
}

export const Debrief: React.FC<DebriefProps> = ({
  result, history, finalTurn, onReplay, onNewScenario, onContinue, hasNextGoal, campaign,
}) => {
  const isLaptop = useMinWidth(1024);
  const victory = result.outcome === 'VICTORY';
  const turningPoints = computeTurningPoints(history);
  const stats = computeStats(history);
  const labels = finalTurn.manifest.statsConfig;

  const finalStats = [
    { k: labels.stabilityLabel,    v: finalTurn.stats.stability,        d: finalTurn.statsDelta.stability },
    { k: labels.wealthLabel,       v: finalTurn.stats.wealth,            d: finalTurn.statsDelta.wealth },
    { k: labels.supportLabel,      v: finalTurn.stats.support,           d: finalTurn.statsDelta.support },
    { k: labels.primaryStatLabel,  v: finalTurn.stats.primaryStatValue,  d: finalTurn.statsDelta.primaryStatValue },
  ];

  if (!isLaptop) {
    return (
      <div style={{ fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1, minHeight: '100vh' }}>
        <section style={{ padding: `${T3.sp6} ${T3.sp5}` }}>
          <Label>Mission Debrief · {history.length} turns</Label>
          <h1 style={{
            fontFamily: T3.fontProse, fontSize: 38, fontWeight: 400, color: T3.fg0,
            margin: `${T3.sp2} 0 0`, letterSpacing: '-0.02em', lineHeight: 1.05,
          }}>
            {result.title}<br />
            <span style={{ color: victory ? T3.sig : T3.neg }}>
              {victory ? 'World intact.' : 'World in ashes.'}
            </span>
          </h1>
          <p style={{
            fontFamily: T3.fontProse, fontSize: T3.s15, lineHeight: 1.55, color: T3.fg1,
            margin: `${T3.sp4} 0 0`,
          }}>{result.description}</p>

          <div style={{
            marginTop: T3.sp6, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: T3.sp4,
          }}>
            <StatTile label="Turns" value={String(stats.turnsPlayed)} />
            <StatTile label="Directives" value={String(stats.directives)} />
            <StatTile label="Custom orders" value={String(stats.customOrders)} />
            <StatTile label="Criticals" value={String(stats.criticalSuccesses)} />
          </div>

          {turningPoints.length > 0 && (
            <div style={{ marginTop: T3.sp6 }}>
              <Label>Turning points</Label>
              <ol style={{
                margin: `${T3.sp3} 0 0`, padding: 0, listStyle: 'none',
                display: 'flex', flexDirection: 'column', gap: T3.sp3,
              }}>
                {turningPoints.map(t => (
                  <li key={t.turnNumber} style={{ paddingTop: T3.sp3, borderTop: `1px solid ${T3.line1}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: T3.fontMono, fontSize: T3.s11, color: T3.fg3 }}>
                        T{String(t.turnNumber).padStart(2, '0')}
                      </span>
                      <Delta value={t.totalDelta} />
                    </div>
                    <div style={{
                      fontFamily: T3.fontProse, fontSize: T3.s15, color: T3.fg0,
                      marginTop: 4, letterSpacing: '-0.005em',
                    }}>{t.eventTitle}</div>
                    {t.userChoice && (
                      <div style={{ fontSize: T3.s11, color: T3.fg3, marginTop: 2 }}>{t.userChoice}</div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div style={{ marginTop: T3.sp6 }}>
            <Label>Final state</Label>
            <div style={{ marginTop: T3.sp3, display: 'flex', flexDirection: 'column' }}>
              {finalStats.map((s, i) => (
                <FinalStatRow key={i} {...s} />
              ))}
            </div>
          </div>

          {campaign && <Declassification campaign={campaign} />}

          <div style={{
            marginTop: T3.sp6, display: 'flex', flexDirection: 'column', gap: T3.sp2,
          }}>
            {hasNextGoal && onContinue && <Button primary onClick={onContinue}>Continue to next goal →</Button>}
            <Button primary={!hasNextGoal} onClick={onReplay}>Replay with new advisors</Button>
            <Button onClick={onNewScenario}>New scenario →</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1,
      minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 420px',
    }}>
      <section style={{ padding: `${T3.sp9} ${T3.sp8}`, overflow: 'auto' }}>
        <Label>Mission Debrief · {history.length} turns</Label>
        <h1 style={{
          fontFamily: T3.fontProse, fontSize: 64, fontWeight: 400, color: T3.fg0,
          margin: `${T3.sp3} 0 0`, letterSpacing: '-0.025em', lineHeight: 1,
          textWrap: 'balance' as any,
        }}>
          {result.title}<br />
          <span style={{ color: victory ? T3.sig : T3.neg }}>
            {victory ? 'World intact.' : 'World in ashes.'}
          </span>
        </h1>
        <p style={{
          fontFamily: T3.fontProse, fontSize: T3.s19, lineHeight: 1.55, color: T3.fg1,
          margin: `${T3.sp6} 0 0`, maxWidth: '62ch', textWrap: 'pretty' as any,
        }}>{result.description}</p>

        <div style={{
          marginTop: T3.sp8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: T3.sp5, maxWidth: 720,
        }}>
          <StatTile label="Turns played" value={String(stats.turnsPlayed)} large />
          <StatTile label="Directives committed" value={String(stats.directives)} large />
          <StatTile label="Custom orders" value={String(stats.customOrders)} large />
          <StatTile label="Critical successes" value={String(stats.criticalSuccesses)} large />
        </div>

        {turningPoints.length > 0 && (
          <div style={{ marginTop: T3.sp8 }}>
            <Label>Turning points · derived from |total Δ|</Label>
            <ol style={{
              margin: `${T3.sp3} 0 0`, padding: 0, listStyle: 'none',
              display: 'flex', flexDirection: 'column', gap: T3.sp3,
            }}>
              {turningPoints.map(t => (
                <li key={t.turnNumber} style={{
                  display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: T3.sp4,
                  paddingTop: T3.sp3, borderTop: `1px solid ${T3.line1}`, alignItems: 'baseline',
                }}>
                  <span style={{ fontFamily: T3.fontMono, fontSize: T3.s13, color: T3.fg3 }}>
                    T{String(t.turnNumber).padStart(2, '0')}
                  </span>
                  <div>
                    <div style={{
                      fontFamily: T3.fontProse, fontSize: T3.s17, color: T3.fg0,
                      letterSpacing: '-0.005em',
                    }}>{t.eventTitle}</div>
                    {t.userChoice && (
                      <div style={{ fontSize: T3.s12, color: T3.fg3, marginTop: 2 }}>{t.userChoice}</div>
                    )}
                  </div>
                  <Delta value={t.totalDelta} />
                </li>
              ))}
            </ol>
          </div>
        )}
        {campaign && <Declassification campaign={campaign} />}
      </section>

      <aside style={{
        background: T3.bg1, borderLeft: `1px solid ${T3.line1}`,
        padding: T3.sp7,
        display: 'flex', flexDirection: 'column', gap: T3.sp6,
        overflow: 'auto',
      }}>
        <div>
          <Label>Final state</Label>
          <div style={{ marginTop: T3.sp3, display: 'flex', flexDirection: 'column' }}>
            {finalStats.map((s, i) => <FinalStatRow key={i} {...s} />)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: T3.sp2 }}>
          {hasNextGoal && onContinue && <Button primary onClick={onContinue}>Continue to next goal →</Button>}
          <Button primary={!hasNextGoal} onClick={onReplay}>Replay with new advisors</Button>
          <Button onClick={onNewScenario}>New scenario →</Button>
        </div>
      </aside>
    </div>
  );
};

const Declassification: React.FC<{ campaign: Campaign }> = ({ campaign }) => {
  const visible = playerVisibleState(campaign.state, campaign.beliefs);
  return <details style={{ marginTop: T3.sp7, border: `1px solid ${T3.line2}`, borderRadius: T3.r3, padding: T3.sp4, background: T3.bg1 }}>
    <summary style={{ cursor: 'pointer', color: T3.sig, fontWeight: 600 }}>Post-game declassification</summary>
    <p style={{ color: T3.fg3, fontSize: T3.s12 }}>Facts released at game over and the belief record that shaped each decision.</p>
    {visible.knownFacts.map((fact) => <div key={fact.id} style={{ padding: `${T3.sp2} 0`, borderTop: `1px solid ${T3.line1}`, color: T3.fg1, fontSize: T3.s12 }}>{fact.statement}<div style={{ color: T3.fg3, fontFamily: T3.fontMono, fontSize: T3.s10 }}>{fact.provenance.replaceAll('_', ' ')} · {fact.sourceRefs.join('; ') || 'scenario record'}</div></div>)}
    <Label style={{ display: 'block', marginTop: T3.sp4 }}>What the player believed</Label>
    {campaign.audits.map((audit) => <details key={audit.id} style={{ marginTop: T3.sp2 }}><summary style={{ color: T3.fg2, cursor: 'pointer', fontSize: T3.s12 }}>Turn {audit.turn} · {audit.narrative.title}</summary><pre style={{ whiteSpace: 'pre-wrap', color: T3.fg3, fontSize: T3.s10, overflow: 'auto' }}>{JSON.stringify(Object.values(audit.previousBeliefSnapshot.player.beliefs), null, 2)}</pre></details>)}
  </details>;
};

const StatTile: React.FC<{ label: string; value: string; large?: boolean }> = ({
  label, value, large,
}) => (
  <div>
    <Label>{label}</Label>
    <div style={{
      fontFamily: T3.fontProse, fontSize: large ? T3.s40 : T3.s28,
      color: T3.fg0, marginTop: 4, fontVariantNumeric: 'tabular-nums',
    }}>{value}</div>
  </div>
);

const FinalStatRow: React.FC<{ k: string; v: number; d: number }> = ({ k, v, d }) => (
  <div style={{ padding: '10px 0', borderBottom: `1px solid ${T3.line1}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: T3.s13, color: T3.fg1 }}>{k}</span>
      <span style={{
        fontFamily: T3.fontProse, fontSize: T3.s22, color: T3.fg0,
        fontVariantNumeric: 'tabular-nums',
      }}>{v}</span>
    </div>
    <div style={{ marginTop: 4 }}>
      <Gauge value={v} delta={d} label={`${k} final ${v}`} />
    </div>
    <div style={{ marginTop: 4 }}><Delta value={d} /></div>
  </div>
);
