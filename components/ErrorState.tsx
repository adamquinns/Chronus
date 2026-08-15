import React from 'react';
import { T3 } from '../theme';
import { Button } from './ui/Primitives';

interface ErrorStateProps {
  code?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  code = 'E_API_FAILURE', message, onRetry, onDismiss,
}) => (
  <div role="alert" style={{
    background: T3.bg1, border: `1px solid oklch(0.5 0.12 25 / 0.5)`,
    borderRadius: T3.r3, padding: T3.sp4,
    display: 'flex', flexDirection: 'column', gap: T3.sp2,
    fontFamily: T3.fontUI, maxWidth: 560,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{
        fontSize: T3.s11, fontFamily: T3.fontMono, color: T3.neg, letterSpacing: '0.08em',
      }}>{code}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: 'transparent', border: 'none', color: T3.fg3,
            cursor: 'pointer', fontSize: T3.s12,
          }}
        >Dismiss</button>
      )}
    </div>
    <p style={{ fontSize: T3.s13, color: T3.fg2, margin: 0, lineHeight: 1.5 }}>{message}</p>
    {onRetry && <div><Button onClick={onRetry}>Retry</Button></div>}
  </div>
);
