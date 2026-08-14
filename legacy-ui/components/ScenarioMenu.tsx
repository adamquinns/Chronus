import React, { useState } from 'react';
import { T3 } from '../theme';
import { Label, Button } from './ui/Primitives';
import { ResumeCard, ResumeSession } from './ResumeCard';
import { ScenarioEditorModal } from './ScenarioEditorModal';
import { PRESET_SCENARIOS } from '../data/scenarios';
import { Scenario } from '../types';

interface ScenarioMenuProps {
  onSelect: (context: string) => void;
  session?: ResumeSession | null;
  onResume?: () => void;
  onDiscardSession?: () => void;
  errorMessage?: string | null;
  onDismissError?: () => void;
}

export const ScenarioMenu: React.FC<ScenarioMenuProps> = ({
  onSelect, session, onResume, onDiscardSession, errorMessage, onDismissError,
}) => {
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState<Scenario | null>(null);

  const handleCustom = () => {
    if (!custom.trim()) return;
    onSelect(
      `CUSTOM SCENARIO CREATED BY PLAYER. CONTEXT: ${custom.trim()}. ` +
      `INSTRUCTIONS: Flesh out this world with specific factions, military assets, and hidden tensions similar to a grand strategy game setup.`
    );
  };

  return (
    <div style={{
      fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1,
      minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr',
    }}>
      <header style={{
        padding: `${T3.sp6} ${T3.sp8}`, borderBottom: `1px solid ${T3.line1}`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: T3.sp4,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp3, marginBottom: T3.sp3 }}>
            <div style={{ width: 10, height: 10, background: T3.sig, borderRadius: 1 }} aria-hidden="true" />
            <span style={{ fontSize: T3.s15, fontWeight: 600, color: T3.fg0, letterSpacing: '-0.01em' }}>Chronus</span>
          </div>
          <h1 style={{
            fontFamily: T3.fontProse, fontSize: T3.s40, fontWeight: 400, color: T3.fg0,
            margin: 0, letterSpacing: '-0.02em', maxWidth: 620, lineHeight: 1.1,
          }}>Choose the situation you want to command.</h1>
          <p style={{
            fontFamily: T3.fontProse, fontSize: T3.s17, color: T3.fg2,
            margin: `${T3.sp3} 0 0`, maxWidth: 560, lineHeight: 1.5,
          }}>
            Each scenario is a pressured decision theatre. You&apos;ll read the brief,
            hear biased counsel, commit a directive, and live with the consequences.
          </p>
        </div>
      </header>

      <main style={{
        padding: T3.sp8, overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: T3.sp6,
      }}>
        {errorMessage && (
          <div role="alert" style={{
            background: T3.bg1, border: `1px solid oklch(0.5 0.12 25 / 0.5)`,
            borderRadius: T3.r3, padding: T3.sp4,
            display: 'flex', flexDirection: 'column', gap: T3.sp2,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{
                fontSize: T3.s11, fontFamily: T3.fontMono, color: T3.neg,
                letterSpacing: '0.08em',
              }}>E_INIT_FAILED</span>
              {onDismissError && (
                <button
                  onClick={onDismissError}
                  aria-label="Dismiss"
                  style={{
                    background: 'transparent', border: 'none', color: T3.fg3,
                    cursor: 'pointer', fontSize: T3.s12,
                  }}
                >Dismiss</button>
              )}
            </div>
            <p style={{ fontSize: T3.s13, color: T3.fg2, margin: 0, lineHeight: 1.5 }}>{errorMessage}</p>
          </div>
        )}

        {session && onResume && onDiscardSession && (
          <ResumeCard
            session={session}
            onResume={onResume}
            onDiscard={onDiscardSession}
          />
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: T3.sp5,
        }}>
          {PRESET_SCENARIOS.map(s => (
            <article
              key={s.id}
              style={{
                background: T3.bg1, border: `1px solid ${T3.line1}`, borderRadius: T3.r3,
                padding: T3.sp5,
                display: 'flex', flexDirection: 'column', gap: T3.sp3,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Label>{s.id.replace(/_/g, ' ')}</Label>
                <span style={{ fontFamily: T3.fontMono, fontSize: T3.s11, color: T3.fg3 }}>{s.startingYear}</span>
              </div>
              <h3 style={{
                fontFamily: T3.fontProse, fontSize: T3.s22, fontWeight: 400, color: T3.fg0,
                margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2,
              }}>{s.title}</h3>
              <p style={{
                fontFamily: T3.fontProse, fontSize: T3.s14, lineHeight: 1.5,
                color: T3.fg2, margin: 0, textWrap: 'pretty' as any, flex: 1,
              }}>{s.description}</p>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: T3.sp2, paddingTop: T3.sp3, borderTop: `1px solid ${T3.line1}`,
                gap: T3.sp2,
              }}>
                <button
                  onClick={() => setEditing(s)}
                  style={{
                    fontFamily: T3.fontUI, fontSize: T3.s11, fontWeight: 600,
                    letterSpacing: '0.06em', background: 'transparent',
                    border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
                    padding: '4px 10px', color: T3.fg2, cursor: 'pointer',
                  }}
                >Edit</button>
                <button
                  onClick={() => onSelect(s.promptContext)}
                  style={{
                    fontFamily: T3.fontUI, fontSize: T3.s12, color: T3.sig,
                    fontWeight: 600, background: 'transparent', border: 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                >Begin →</button>
              </div>
            </article>
          ))}
        </div>

        <div style={{
          background: T3.bg1, border: `1px dashed ${T3.line2}`, borderRadius: T3.r3,
          padding: T3.sp5, display: 'flex', flexDirection: 'column', gap: T3.sp3,
        }}>
          <Label>Custom divergence</Label>
          <p style={{
            margin: 0, fontFamily: T3.fontProse, fontSize: T3.s14, lineHeight: 1.5, color: T3.fg2,
            textWrap: 'pretty' as any,
          }}>
            Describe any historical event, era, or &ldquo;what if&rdquo; scenario.
            The simulator will generate the world state.
          </p>
          <div style={{ display: 'flex', gap: T3.sp3, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCustom(); }}
              placeholder="e.g. Napoleon wins Waterloo, or the Internet was never invented…"
              style={{
                flex: 1, minWidth: 280,
                background: T3.bg0, border: `1px solid ${T3.line2}`, borderRadius: T3.r3,
                padding: '11px 14px',
                fontFamily: T3.fontProse, fontSize: T3.s14, color: T3.fg0,
                outline: 'none',
              }}
            />
            <Button primary disabled={!custom.trim()} onClick={handleCustom}>Generate →</Button>
          </div>
        </div>
      </main>

      {editing && (
        <ScenarioEditorModal
          scenario={editing}
          onCancel={() => setEditing(null)}
          onLaunch={(ctx) => { setEditing(null); onSelect(ctx); }}
        />
      )}
    </div>
  );
};
