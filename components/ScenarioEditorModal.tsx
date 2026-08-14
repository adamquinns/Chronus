import React, { useState } from 'react';
import { T3 } from '../theme';
import { Label, Button } from './ui/Primitives';
import { Scenario } from '../types';

interface ScenarioEditorModalProps {
  scenario: Scenario;
  onCancel: () => void;
  onLaunch: (editedContext: string) => void;
}

export const ScenarioEditorModal: React.FC<ScenarioEditorModalProps> = ({
  scenario, onCancel, onLaunch,
}) => {
  const [context, setContext] = useState(scenario.promptContext.trim());

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: T3.zModal,
      display: 'grid', placeItems: 'center', padding: T3.sp4,
    }}>
      <div onClick={onCancel} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
      }} />
      <div role="dialog" aria-label="Scenario editor" style={{
        position: 'relative', width: 'min(900px, 100%)', maxHeight: '85vh',
        background: T3.bg1, border: `1px solid ${T3.line2}`, borderRadius: T3.r4,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: T3.fontUI,
      }}>
        <header style={{
          padding: `${T3.sp4} ${T3.sp5}`, borderBottom: `1px solid ${T3.line1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <Label>Scenario Editor</Label>
            <div style={{ fontSize: T3.s15, color: T3.fg0, fontWeight: 600, marginTop: 2 }}>
              {scenario.title} · {scenario.startingYear}
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close editor"
            style={{
              background: 'transparent', border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
              padding: '4px 9px', color: T3.fg2, cursor: 'pointer', fontSize: T3.s12,
            }}
          >Close</button>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: T3.sp5 }}>
          <Label>Prompt context</Label>
          <p style={{
            margin: `${T3.sp2} 0 ${T3.sp3}`,
            fontFamily: T3.fontProse, fontSize: T3.s14, lineHeight: 1.5, color: T3.fg2,
            textWrap: 'pretty' as any,
          }}>
            The raw seed used to build the simulation. Define factions, assets, and the
            opening crisis — the simulator will derive the rest.
          </p>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 360,
              background: T3.bg0, border: `1px solid ${T3.line2}`, borderRadius: T3.r3,
              padding: T3.sp4, resize: 'vertical',
              fontFamily: T3.fontMono, fontSize: T3.s13, lineHeight: 1.55,
              color: T3.fg1, outline: 'none',
            }}
          />
        </div>

        <footer style={{
          padding: `${T3.sp3} ${T3.sp5}`, borderTop: `1px solid ${T3.line1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: T3.s11, color: T3.fg3 }}>
            Edits apply on launch. Original scenario not modified.
          </span>
          <div style={{ display: 'flex', gap: T3.sp2 }}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button primary disabled={!context.trim()} onClick={() => onLaunch(context.trim())}>
              Launch divergence →
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
};
