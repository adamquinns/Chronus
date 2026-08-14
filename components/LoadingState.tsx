import React from 'react';
import { T3 } from '../theme';

interface LoadingStateProps {
  status?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ status = 'Simulating outcome…' }) => (
  <div style={{
    background: T3.bg0, minHeight: '100vh',
    display: 'grid', placeItems: 'center', fontFamily: T3.fontUI,
  }}>
    <div style={{
      background: T3.bg1, border: `1px solid ${T3.line1}`, borderRadius: T3.r3,
      padding: `${T3.sp5} ${T3.sp6}`, minWidth: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: T3.sp2, marginBottom: T3.sp3 }}>
        <div style={{ width: 8, height: 8, background: T3.sig, borderRadius: 1 }} aria-hidden="true" />
        <span aria-live="polite" style={{
          fontSize: T3.s15, color: T3.fg1, fontWeight: 500,
        }}>{status}</span>
      </div>
      <div aria-hidden="true" style={{
        height: 2, background: T3.bg3, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, width: '40%',
          background: T3.sig, animation: 'chronusProg 1.8s ease-in-out infinite',
        }} />
      </div>
    </div>
  </div>
);
