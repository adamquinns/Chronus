import React, { useState } from 'react';
import { T3 } from '../theme';
import { Button, Label } from './ui/Primitives';

export interface SavedCampaignSummary {
  id: string;
  title: string;
  turn: number;
  dateLabel: string;
  updatedAt: string;
}

interface Props {
  sessions: SavedCampaignSummary[];
  onSelect: (scenarioId: string) => void;
  onResume: (campaignId: string) => void;
  onDelete: (campaignId: string) => void;
  onImport: (file: File) => void;
  onCustom: (prompt: string) => void;
  customEnabled: boolean;
  generating?: boolean;
  errorMessage?: string;
  onChangeAccess: () => void;
}

const scenarios = [
  {
    id: 'cuban_missile_crisis_black_saturday', year: 'October 27, 1962', label: 'Nuclear crisis',
    title: 'Midnight in Havana',
    description: 'A U-2 pilot is dead. The Joint Chiefs want action. Moscow is sending contradictory signals, and every hour narrows the path away from war.',
  },
  {
    id: 'american_twilight', year: 'A speculative near future', label: 'Constitutional crisis',
    title: 'Twilight of the Republic',
    description: 'Election administration, federal power, organized labor, governors, courts, and public legitimacy collide in a widening national confrontation.',
  },
];

export const ScenarioMenu: React.FC<Props> = ({
  sessions, onSelect, onResume, onDelete, onImport, onCustom, customEnabled, generating, errorMessage, onChangeAccess,
}) => {
  const [custom, setCustom] = useState('');
  return <div style={{ fontFamily: T3.fontUI, background: T3.bg0, color: T3.fg1, minHeight: '100vh' }}>
    <header style={{ padding: `${T3.sp7} ${T3.sp8}`, borderBottom: `1px solid ${T3.line1}` }}>
      <div style={{ display: 'flex', gap: T3.sp3, alignItems: 'center' }}><div style={{ width: 10, height: 10, background: T3.sig }}/><strong style={{ color: T3.fg0 }}>Chronus</strong></div>
      <h1 style={{ fontFamily: T3.fontProse, fontSize: T3.s40, fontWeight: 400, color: T3.fg0, maxWidth: 720, margin: `${T3.sp4} 0 ${T3.sp2}` }}>Choose the history you want to inhabit.</h1>
      <p style={{ fontFamily: T3.fontProse, fontSize: T3.s17, color: T3.fg2, maxWidth: 650, lineHeight: 1.5 }}>Read the room, hear counsel from people with memories and agendas, commit a strategy, and live with a world that moves on its own.</p>
    </header>
    <main style={{ padding: T3.sp8, display: 'flex', flexDirection: 'column', gap: T3.sp6 }}>
      {errorMessage && <div role="alert" style={{ border: `1px solid ${T3.neg}`, borderRadius: T3.r3, padding: T3.sp4, color: T3.neg }}>{errorMessage}</div>}
      {sessions.length > 0 && <section>
        <Label tone="sig">Saved timelines</Label>
        <div style={{ marginTop: T3.sp3, display: 'grid', gap: T3.sp3 }}>
          {sessions.map((session) => <article key={session.id} style={{ background: T3.bg1, border: `1px solid ${T3.sigLine}`, borderRadius: T3.r3, padding: T3.sp4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T3.sp4, flexWrap: 'wrap' }}>
            <div><div style={{ color: T3.fg0, fontFamily: T3.fontProse, fontSize: T3.s19 }}>{session.title}</div><div style={{ color: T3.fg3, fontSize: T3.s11, marginTop: 3 }}>Turn {session.turn} · {session.dateLabel} · saved {new Date(session.updatedAt).toLocaleString()}</div></div>
            <div style={{ display: 'flex', gap: T3.sp2 }}><Button onConfirm={() => onDelete(session.id)} confirmLabel="Delete save">Delete</Button><Button primary onClick={() => onResume(session.id)}>Resume →</Button></div>
          </article>)}
        </div>
      </section>}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: T3.sp5 }}>
        {scenarios.map((scenario) => <article key={scenario.id} style={{ background: T3.bg1, border: `1px solid ${T3.line1}`, borderRadius: T3.r4, padding: T3.sp5, display: 'flex', flexDirection: 'column', gap: T3.sp3 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Label>{scenario.label}</Label><span style={{ color: T3.fg3, fontFamily: T3.fontMono, fontSize: T3.s11 }}>{scenario.year}</span></div>
          <h2 style={{ fontFamily: T3.fontProse, fontSize: T3.s28, fontWeight: 400, color: T3.fg0, margin: 0 }}>{scenario.title}</h2>
          <p style={{ fontFamily: T3.fontProse, color: T3.fg2, lineHeight: 1.55, flex: 1 }}>{scenario.description}</p>
          <Button primary onClick={() => onSelect(scenario.id)}>Enter the situation →</Button>
        </article>)}
      </section>
      <section style={{ border: `1px dashed ${T3.line2}`, borderRadius: T3.r3, padding: T3.sp5 }}>
        <Label>Author another divergence</Label>
        <div style={{ display: 'flex', gap: T3.sp3, flexWrap: 'wrap', marginTop: T3.sp3 }}>
          <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Describe a setting, role, and central crisis…" style={{ flex: 1, minWidth: 260, background: T3.bg1, border: `1px solid ${T3.line2}`, borderRadius: T3.r3, color: T3.fg0, padding: 12 }}/>
          <Button primary disabled={!customEnabled || !custom.trim() || generating} onClick={() => onCustom(custom)}>{generating ? 'Validating…' : 'Generate →'}</Button>
        </div>
        {!customEnabled && <div style={{ color: T3.fg3, fontSize: T3.s11, marginTop: 8 }}>Custom generation requires live model access.</div>}
      </section>
      <div style={{ display: 'flex', gap: T3.sp3, flexWrap: 'wrap' }}>
        <label style={{ border: `1px solid ${T3.line2}`, borderRadius: T3.r1, padding: '8px 12px', cursor: 'pointer', fontSize: T3.s12 }}>Import campaign<input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }}/></label>
        <button onClick={onChangeAccess} style={{ background: 'transparent', border: 0, color: T3.fg3, cursor: 'pointer' }}>Change model access</button>
      </div>
    </main>
  </div>;
};
