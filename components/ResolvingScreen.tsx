import React from 'react';
import { TurnPreview, TurnProgress } from '../engine/domain';
import { T3 } from '../theme';
import { Button, Chip, Label } from './ui/Primitives';

interface ResolvingScreenProps {
  directive: string;
  preview?: TurnPreview;
  progress: TurnProgress[];
  resolved: boolean;
  error?: string;
  onAdvance: () => void;
  onRetry: () => void;
  onAbort: () => void;
}

export const ResolvingScreen: React.FC<ResolvingScreenProps> = ({
  directive, preview, progress, resolved, error, onAdvance, onRetry, onAbort,
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
      </section>

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
