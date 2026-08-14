import React, { PropsWithChildren, useEffect } from 'react';
import { T3 } from '../theme';

interface BottomSheetProps {
  onClose: () => void;
}

export const BottomSheet: React.FC<PropsWithChildren<BottomSheetProps>> = ({ children, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: T3.zSheet,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: T3.zScrim }}
      />
      <div style={{
        position: 'relative', zIndex: T3.zSheet,
        background: T3.bg1, borderTop: `1px solid ${T3.line2}`,
        borderTopLeftRadius: T3.r4, borderTopRightRadius: T3.r4,
        padding: T3.sp5, maxHeight: '78vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: T3.sp3 }}>
          <div style={{ width: 36, height: 3, background: T3.line3, borderRadius: 2 }} />
        </div>
        {children}
      </div>
    </div>
  );
};
