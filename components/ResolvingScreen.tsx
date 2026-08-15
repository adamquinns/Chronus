import React, { useState } from 'react';
import { ForecastOutcome, PlayerForecast } from '../engine/ledger/api';

interface TurnProgress { stage: string; label: string; detail?: string; status: 'STARTED' | 'COMPLETED'; at: string }
interface TurnPreview { strategy: string; advantages: string[]; uncertainties: string[]; stakes: string[]; advisorAssessments: string[]; intelligenceNotes: string[]; strategicTradeoffs: string[] }
type ForecastActorStance = 'ESCALATES' | 'HOLDS' | 'ENGAGES';
import { T3 } from '../theme';
import { Button, Chip, Label } from './ui/Primitives';

interface ResolvingScreenProps {
  directive: string;
  preview?: TurnPreview;
  progress: TurnProgress[];
  resolved: boolean;
  error?: string;
  /** Previous turn's press digest — genuine reading material, produced before
   * this turn began, so it costs no extra latency and can spoil nothing. */
  morningPaper?: Array<{ source: string; headline: string; body: string }>;
  forecastActors?: Array<{ id: string; name: string }>;
  forecastSubmitted: boolean;
  onSubmitForecast: (forecast: PlayerForecast) => void;
  onSkipForecast: () => void;
  onOpenConsult: () => void;
  onAdvance: () => void;
  onRetry: () => void;
  onAbort: () => void;
}

const OUTCOMES: Array<{ id: ForecastOutcome; label: string }> = [
  { id: 'SETBACK', label: 'Setback' },
  { id: 'MIXED', label: 'Mixed' },
  { id: 'SUCCESS', label: 'Success' },
  { id: 'STRONG_SUCCESS', label: 'Strong success' },
];
const STANCES: ForecastActorStance[] = ['ESCALATES', 'HOLDS', 'ENGAGES'];

const ForecastPanel: React.FC<{
  actors: Array<{ id: string; name: string }>;
  onSubmit: (forecast: PlayerForecast) => void;
  onSkip: () => void;
}> = ({ actors, onSubmit, onSkip }) => {
  const [outcome, setOutcome] = useState<ForecastOutcome>();
  const [stances, setStances] = useState<Record<string, ForecastActorStance>>({});
  const [freeText, setFreeText] = useState('');
  return (
    <section style={{
      marginBottom: T3.sp7, padding: T3.sp5,
      border: `1px solid ${T3.sigLine}`, background: T3.sigBg, borderRadius: T3.r3,
    }}>
      <Label>Before the world answers · optional</Label>
      <p style={{ color: T3.fg2, fontSize: T3.s13, margin: `${T3.sp2} 0 ${T3.sp4}` }}>
        Commit to what you expect. Chronus scores it against the committed outcome and tracks your calibration across the campaign.
      </p>
      <div style={{ marginBottom: T3.sp4 }}>
        <Label>Overall outcome</Label>
        <div style={{ display: 'flex', gap: T3.sp2, flexWrap: 'wrap', marginTop: T3.sp2 }}>
          {OUTCOMES.map((option) => (
            <button
              key={option.id}
              onClick={() => setOutcome(option.id)}
              aria-pressed={outcome === option.id}
              style={{
                padding: `${T3.sp2} ${T3.sp3}`, borderRadius: T3.r2, cursor: 'pointer',
                fontFamily: T3.fontUI, fontSize: T3.s12,
                border: `1px solid ${outcome === option.id ? T3.sig : T3.line2}`,
                background: outcome === option.id ? T3.sigBg : T3.bg2,
                color: outcome === option.id ? T3.fg0 : T3.fg2,
              }}
            >{option.label}</button>
          ))}
        </div>
      </div>
      {actors.slice(0, 2).map((actor) => (
        <div key={actor.id} style={{ marginBottom: T3.sp3 }}>
          <Label>{actor.name}</Label>
          <div style={{ display: 'flex', gap: T3.sp2, flexWrap: 'wrap', marginTop: T3.sp2 }}>
            {STANCES.map((stance) => (
              <button
                key={stance}
                onClick={() => setStances((current) => ({ ...current, [actor.id]: stance }))}
                aria-pressed={stances[actor.id] === stance}
                style={{
                  padding: `${T3.sp2} ${T3.sp3}`, borderRadius: T3.r2, cursor: 'pointer',
                  fontFamily: T3.fontUI, fontSize: T3.s11, letterSpacing: '0.06em',
                  border: `1px solid ${stances[actor.id] === stance ? T3.sig : T3.line2}`,
                  background: stances[actor.id] === stance ? T3.sigBg : T3.bg2,
                  color: stances[actor.id] === stance ? T3.fg0 : T3.fg3,
                }}
              >{stance}</button>
            ))}
          </div>
        </div>
      ))}
      <textarea
        value={freeText}
        onChange={(event) => setFreeText(event.target.value)}
        placeholder="Optional: what specifically do you expect to happen?"
        rows={2}
        style={{
          width: '100%', marginTop: T3.sp3, padding: T3.sp3, borderRadius: T3.r2,
          background: T3.bg1, border: `1px solid ${T3.line2}`, color: T3.fg1,
          fontFamily: T3.fontUI, fontSize: T3.s12, resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', gap: T3.sp3, marginTop: T3.sp3 }}>
        <Button
          onClick={() => outcome && onSubmit({
            outcome,
            actorPredictions: Object.entries(stances).map(([actorId, stance]) => ({ actorId, stance })),
            freeText: freeText.trim() || undefined,
          })}
          disabled={!outcome}
        >Lock in forecast</Button>
        <Button onClick={onSkip}>Skip</Button>
      </div>
    </section>
  );
};

export const ResolvingScreen: React.FC<ResolvingScreenProps> = ({
  directive, preview, progress, resolved, error, morningPaper, forecastActors,
  forecastSubmitted, onSubmitForecast, onSkipForecast, onOpenConsult, onAdvance, onRetry, onAbort,
}) => (
  <div style={{
    fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1, minHeight: '100vh',
    display: 'grid', gridTemplateRows: 'auto 1fr auto',
  }}>
    <header style={{
      padding: `${T3.sp4} ${T3.sp6}`, borderBottom: `1px solid ${T3.line1}`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', gap: T3.sp3, alignItems: 'center' }}>
        <div style={{ width: 8, height: 8, background: T3.sig }} />
        <strong style={{ color: T3.fg0 }}>Directive Resolution</strong>
      </div>
      <Chip tone="sig">{resolved ? 'Outcome committed' : 'Simulation active'}</Chip>
    </header>

    <main style={{ width: 'min(760px, 100%)', margin: '0 auto', padding: T3.sp7 }}>
      <section style={{ marginBottom: T3.sp7 }}>
        <Label>Directive received</Label>
        <h1 style={{ fontFamily: T3.fontProse, fontSize: T3.s28, fontWeight: 400, color: T3.fg0, lineHeight: 1.3 }}>
          {preview?.strategy ?? directive}
        </h1>
        {preview && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: T3.sp4 }}>
          <PreviewList title="Known advantages" items={preview.advantages} />
          <PreviewList title="Uncertainties" items={preview.uncertainties} />
          <PreviewList title="Stakes" items={preview.stakes} />
        </div>}
        <div style={{ marginTop: T3.sp4 }}>
          <Button onClick={onOpenConsult}>Consult the cabinet while you wait</Button>
        </div>
      </section>

      {!forecastSubmitted && forecastActors && (
        <ForecastPanel actors={forecastActors} onSubmit={onSubmitForecast} onSkip={onSkipForecast} />
      )}

      {!resolved && morningPaper && morningPaper.length > 0 && (
        <section style={{ marginBottom: T3.sp7 }}>
          <Label>While you wait · the last cycle’s press</Label>
          <div style={{ display: 'grid', gap: T3.sp3, marginTop: T3.sp3 }}>
            {morningPaper.slice(0, 3).map((item, index) => (
              <article key={index} style={{
                padding: T3.sp4, background: T3.bg1, border: `1px solid ${T3.line1}`, borderRadius: T3.r2,
              }}>
                <div style={{ fontSize: T3.s10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T3.fg3 }}>{item.source}</div>
                <div style={{ fontFamily: T3.fontProse, fontSize: T3.s15, color: T3.fg0, margin: `${T3.sp2} 0` }}>{item.headline}</div>
                <p style={{ fontSize: T3.s12, color: T3.fg2, lineHeight: 1.55, margin: 0 }}>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section style={{ background: T3.bg1, border: `1px solid ${T3.line1}`, borderRadius: T3.r4, padding: T3.sp5 }}>
        <Label>Simulation</Label>
        <div style={{ marginTop: T3.sp3, display: 'flex', flexDirection: 'column', gap: T3.sp3 }} aria-live="polite">
          {progress.length === 0 && <div style={{ color: T3.fg3 }}>• Receiving and compiling the directive…</div>}
          {progress.map((item) => <div key={`${item.stage}-${item.status}`} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: T3.sp2 }}>
            <span style={{ color: item.status === 'COMPLETED' ? T3.sig : T3.fg2 }}>{item.status === 'COMPLETED' ? '✓' : '•'}</span>
            <div>
              <div style={{ color: T3.fg0, fontSize: T3.s13 }}>{item.label}</div>
              {item.detail && <div style={{ color: T3.fg3, fontSize: T3.s11, marginTop: 2 }}>{item.detail}</div>}
            </div>
          </div>)}
        </div>
      </section>
    </main>

    <footer style={{ padding: T3.sp4, borderTop: `1px solid ${T3.line1}`, display: 'flex', justifyContent: 'flex-end', gap: T3.sp2 }}>
      {error ? <>
        <span role="alert" style={{ marginRight: 'auto', color: T3.neg }}>{error}</span>
        <Button onClick={onAbort}>Back</Button><Button primary onClick={onRetry}>Retry</Button>
      </> : <Button primary disabled={!resolved} onClick={onAdvance}>Read the situation report →</Button>}
    </footer>
  </div>
);

const PreviewList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <div>
  <Label>{title}</Label>
  <ul style={{ margin: `${T3.sp2} 0 0`, paddingLeft: 18, color: T3.fg2, fontSize: T3.s12, lineHeight: 1.5 }}>
    {items.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
  </ul>
</div>;
