import React from 'react';
import { T3 } from '../theme';
import { Label, Button } from './ui/Primitives';

export interface ResumeSession {
  scenario: string;
  turn: number;
  totalTurns: number;
  savedAt: string;
}

interface ResumeCardProps {
  session: ResumeSession;
  onResume: () => void;
  onDiscard: () => void;
}

export const ResumeCard: React.FC<ResumeCardProps> = ({ session, onResume, onDiscard }) => (
  <div style={{
    background: T3.bg1, border: `1px solid ${T3.sigLine}`, borderRadius: T3.r3,
    padding: `${T3.sp4} ${T3.sp5}`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: T3.sp4,
    fontFamily: T3.fontUI, flexWrap: 'wrap',
  }}>
    <div>
      <Label tone="sig">Session Detected · Active Timeline</Label>
      <div style={{
        fontFamily: T3.fontProse, fontSize: T3.s19, color: T3.fg0,
        marginTop: 4, letterSpacing: '-0.005em',
      }}>
        {session.scenario} · Turn {session.turn} of {session.totalTurns}
      </div>
      <div style={{ fontSize: T3.s11, color: T3.fg3, marginTop: 2 }}>Saved {session.savedAt}</div>
    </div>
    <div style={{ display: 'flex', gap: T3.sp2 }}>
      <Button onConfirm={onDiscard} confirmLabel="Discard session">Discard</Button>
      <Button primary onClick={onResume}>Resume →</Button>
    </div>
  </div>
);
