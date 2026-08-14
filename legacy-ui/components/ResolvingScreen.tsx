import React, { useEffect, useState } from 'react';
import { T3 } from '../theme';
import { useMinWidth } from '../hooks/useBreakpoint';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Label, Chip, Delta, Risk, Button, RiskLevel } from './ui/Primitives';
import { TurnData, ExecutionAnalysis } from '../types';

interface ResolvingScreenProps {
  committedChoiceText: string;
  perceivedRisk: RiskLevel;
  forecastedRange: string;
  prevManifest: TurnData['manifest'];
  nextTurn: TurnData | null;          // null = still awaiting
  error: string | null;
  onAdvance: () => void;
  onRetry: () => void;
  onAbort: () => void;
}

// Phase machine: 'await' (roll in progress) → 'reveal' (d20 counts up) → 'result' (outcome shown).
export const ResolvingScreen: React.FC<ResolvingScreenProps> = (props) => {
  const isLaptop = useMinWidth(1024);
  const reduced = useReducedMotion();

  const analysis = props.nextTurn?.executionAnalysis;
  const phase: 'await' | 'reveal' | 'result' = !analysis ? 'await' : 'reveal';

  const [rollDisplay, setRollDisplay] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Parse the "14/20" format safely.
  const [rollNum, rollMax] = analysis?.rollValue
    ? analysis.rollValue.split('/').map(n => parseInt(n, 10) || 0)
    : [0, 20];

  // Count-up animation on reveal.
  useEffect(() => {
    if (phase !== 'reveal' || rollNum === 0) return;
    if (reduced) { setRollDisplay(rollNum); return; }
    let frame: number;
    let start: number | null = null;
    const duration = 800;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setRollDisplay(Math.round(1 + (rollNum - 1) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, rollNum, reduced]);

  // Reveal → Result: hold the roll for a beat, then show the outcome.
  useEffect(() => {
    if (phase !== 'reveal') { setShowResult(false); return; }
    const t = setTimeout(() => setShowResult(true), reduced ? 200 : 1400);
    return () => clearTimeout(t);
  }, [phase, reduced]);

  const outcomeLabel = analysis?.outcomeLabel ?? '';
  const intelModifier = analysis?.intelModifierValue ?? 0;
  const prevLabels = props.prevManifest.statsConfig;

  const statDeltas = props.nextTurn ? [
    { label: prevLabels.stabilityLabel,    delta: props.nextTurn.statsDelta.stability },
    { label: prevLabels.wealthLabel,       delta: props.nextTurn.statsDelta.wealth },
    { label: prevLabels.supportLabel,      delta: props.nextTurn.statsDelta.support },
    { label: prevLabels.primaryStatLabel,  delta: props.nextTurn.statsDelta.primaryStatValue },
  ] : [];

  return (
    <div style={{
      fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1,
      minHeight: '100vh',
      display: 'grid', gridTemplateRows: 'auto 1fr auto',
    }}>
      {/* Header */}
      <header style={{
        padding: isLaptop ? `${T3.sp4} ${T3.sp6}` : `${T3.sp4} ${T3.sp5}`,
        borderBottom: `1px solid ${T3.line1}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp3 }}>
          <div style={{ width: 8, height: 8, background: T3.sig, borderRadius: 1 }} aria-hidden="true" />
          <span style={{ fontSize: T3.s13, fontWeight: 600, color: T3.fg0 }}>Directive Resolution</span>
        </div>
        <Chip tone="sig">{phase === 'await' ? 'Resolving…' : 'Resolved'}</Chip>
      </header>

      {/* Main stage */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: isLaptop ? '1fr minmax(520px, 560px) 1fr' : '1fr',
        alignItems: 'center', padding: isLaptop ? T3.sp8 : T3.sp5,
      }}>
        {isLaptop && <div />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: isLaptop ? T3.sp6 : T3.sp5 }}>
          {/* Directive recap */}
          <div style={{ textAlign: 'center' }}>
            <Label>Directive Committed</Label>
            <h2 style={{
              fontFamily: T3.fontProse, fontSize: isLaptop ? T3.s22 : T3.s19, fontWeight: 400,
              color: T3.fg0, margin: `${T3.sp2} 0 0`,
              letterSpacing: '-0.01em', lineHeight: 1.3,
            }}>{props.committedChoiceText}</h2>
            <div style={{
              marginTop: T3.sp2, display: 'flex', gap: T3.sp3,
              justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap',
            }}>
              <Risk level={props.perceivedRisk} />
              <span style={{ fontSize: T3.s11, color: T3.fg3 }}>·</span>
              <span style={{
                fontSize: T3.s11, color: T3.fg3, fontFamily: T3.fontMono,
              }}>{props.forecastedRange}</span>
            </div>
          </div>

          {/* Roll panel */}
          <div style={{
            background: T3.bg1,
            border: `1px solid ${phase === 'await' ? T3.line1 : T3.sigLine}`,
            borderRadius: T3.r4,
            padding: isLaptop ? T3.sp7 : T3.sp5,
            minHeight: isLaptop ? 180 : 140,
            display: 'grid',
            gridTemplateColumns: isLaptop ? '1fr auto 1fr' : '1fr',
            alignItems: 'center', gap: isLaptop ? T3.sp5 : T3.sp3,
            position: 'relative', overflow: 'hidden', textAlign: 'center',
          }}>
            {phase === 'await' && !reduced && (
              <div aria-hidden="true" style={{
                position: 'absolute', top: 0, bottom: 0, width: 3, background: T3.sig,
                animation: 'chronusSweep 1.4s linear infinite',
              }} />
            )}

            {isLaptop && (
              <div style={{ textAlign: 'right' }}>
                <Label>Forecast Matrix</Label>
                <div style={{ fontSize: T3.s13, color: T3.fg1, marginTop: 4 }}>Base range rolled</div>
                <div style={{
                  fontSize: T3.s11, color: T3.fg3, fontFamily: T3.fontMono, marginTop: 2,
                }}>d20 modulus</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span
                aria-live="polite"
                aria-label={analysis
                  ? `Die roll result: ${rollNum} of ${rollMax}`
                  : 'Rolling die'}
                style={{
                  fontFamily: T3.fontProse, fontSize: T3.s64, fontWeight: 400,
                  color: phase === 'await' ? T3.fg3 : T3.sig, lineHeight: 1,
                  letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
                }}
              >{phase === 'await' ? '—' : (rollDisplay ?? rollNum)}</span>
              <span style={{
                fontSize: T3.s11, color: T3.fg3, letterSpacing: '0.16em',
                textTransform: 'uppercase', fontWeight: 600,
              }}>of {rollMax || 20}</span>
            </div>

            {isLaptop && (
              <div style={{ textAlign: 'left' }}>
                <Label>Intel Modifier</Label>
                <div style={{
                  fontSize: T3.s13, marginTop: 4, fontFamily: T3.fontMono,
                  color: phase === 'await'
                    ? T3.fg3
                    : intelModifier >= 0 ? T3.pos : T3.neg,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {phase === 'await'
                    ? '—'
                    : `${intelModifier >= 0 ? '+' : ''}${intelModifier}`}
                </div>
                <div style={{ fontSize: T3.s11, color: T3.fg3, marginTop: 2 }}>
                  Applied to base roll
                </div>
              </div>
            )}

            {!isLaptop && phase !== 'await' && (
              <div style={{ fontSize: T3.s11, color: T3.fg3 }}>
                {`${intelModifier >= 0 ? '+' : ''}${intelModifier} intel modifier`}
              </div>
            )}
          </div>

          {/* Outcome — only in result phase */}
          <div style={{
            textAlign: 'center',
            opacity: showResult ? 1 : 0,
            transition: 'opacity 400ms',
            minHeight: isLaptop ? 180 : 120,
          }}>
            {analysis && (
              <>
                <Label tone="sig">Outcome</Label>
                <div style={{
                  fontFamily: T3.fontProse,
                  fontSize: isLaptop ? T3.s28 : T3.s19,
                  fontWeight: 400, color: T3.fg0,
                  margin: `${T3.sp2} auto 0`,
                  letterSpacing: '-0.015em', lineHeight: 1.25, maxWidth: 520,
                }}>{outcomeLabel}</div>
              </>
            )}
          </div>
        </div>

        {isLaptop && <div />}
      </main>

      {/* Footer — stat deltas + advance */}
      <footer style={{
        padding: isLaptop ? T3.sp6 : T3.sp4,
        borderTop: `1px solid ${T3.line1}`, background: T3.bg1,
        display: 'flex',
        flexDirection: isLaptop ? 'row' : 'column',
        justifyContent: 'space-between', alignItems: isLaptop ? 'center' : 'stretch',
        gap: T3.sp4,
      }}>
        {props.error ? (
          <div role="alert" style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: T3.sp3,
          }}>
            <span style={{
              fontSize: T3.s11, fontFamily: T3.fontMono, color: T3.neg,
              letterSpacing: '0.08em',
            }}>E_SIMULATION_FAILED</span>
            <span style={{ fontSize: T3.s13, color: T3.fg2 }}>{props.error}</span>
          </div>
        ) : (
          <div style={{
            display: 'flex', gap: isLaptop ? T3.sp6 : T3.sp4, flexWrap: 'wrap',
          }}>
            {statDeltas.map((s, i) => (
              <div key={i}>
                <Label>{s.label}</Label>
                <div style={{ marginTop: 2 }}>
                  <Delta value={s.delta} ariaLabel={`${s.label} changed by ${s.delta}`} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: T3.sp2 }}>
          {props.error ? (
            <>
              <Button onClick={props.onAbort}>Back to menu</Button>
              <Button primary onClick={props.onRetry}>Retry</Button>
            </>
          ) : (
            <Button primary disabled={!showResult} onClick={props.onAdvance}>
              Advance to Turn {(props.nextTurn?.turnNumber ?? 0) + 1 || '…'} →
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
