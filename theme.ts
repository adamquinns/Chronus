// Chronus v3.1 — "Situation Console" design tokens.
// Operational, not archival. Single accent (amber). Green/red reserved for stat deltas.

export const T3 = {
  bg0:   'oklch(0.155 0.008 250)',
  bg1:   'oklch(0.195 0.008 250)',
  bg2:   'oklch(0.235 0.008 250)',
  bg3:   'oklch(0.275 0.008 250)',
  bg4:   'oklch(0.325 0.008 250)',
  bg5:   'oklch(0.385 0.008 250)',

  fg0:   'oklch(0.985 0.003 250)',
  fg1:   'oklch(0.92 0.005 250)',
  fg2:   'oklch(0.78 0.006 250)',
  fg3:   'oklch(0.64 0.008 250)',
  fg4:   'oklch(0.48 0.010 250)',

  line1: 'oklch(0.30 0.010 250)',
  line2: 'oklch(0.38 0.010 250)',
  line3: 'oklch(0.48 0.010 250)',

  sig:     'oklch(0.80 0.15 75)',
  sigBg:   'oklch(0.38 0.10 75 / 0.18)',
  sigLine: 'oklch(0.55 0.14 75 / 0.45)',

  pos:     'oklch(0.78 0.15 160)',
  neg:     'oklch(0.72 0.16 25)',

  force:       'oklch(0.70 0.14 25)',
  diplomacy:   'oklch(0.72 0.11 220)',
  profit:      'oklch(0.75 0.12 95)',
  innovation:  'oklch(0.72 0.11 290)',

  riskLow: 'oklch(0.50 0.005 250)',
  risk2:   'oklch(0.62 0.008 250)',
  risk3:   'oklch(0.78 0.010 250)',
  risk4:   'oklch(0.92 0.012 250)',

  fontProse:  '"Source Serif 4", "Iowan Old Style", Georgia, serif',
  fontUI:     '"Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontMono:   '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',

  s10: '10px', s11: '11px', s12: '12px', s13: '13px', s14: '14px',
  s15: '15px', s17: '17px', s19: '19px', s22: '22px', s28: '28px',
  s40: '40px', s64: '64px',

  r1: '2px', r2: '3px', r3: '5px', r4: '8px',

  sp1: '4px',  sp2: '8px',  sp3: '12px', sp4: '16px', sp5: '20px',
  sp6: '24px', sp7: '32px', sp8: '40px', sp9: '56px',

  zSticky: 5,
  zScrim:  9,
  zSheet:  10,
  zModal:  20,
} as const;

export type AdvisorBias = 'force' | 'diplomacy' | 'profit' | 'innovation';

// Inject global stylesheet on first import:
//  - focus-visible ring
//  - prefers-reduced-motion override
//  - solid hex fallbacks for browsers that don't parse oklch()
const STYLE_ID = '__chronus_v31_global';
export function ensureGlobalStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    :focus { outline: none; }
    button:focus-visible, [role=button]:focus-visible, [tabindex]:focus-visible,
    a:focus-visible, input:focus-visible, textarea:focus-visible {
      outline: 1.5px solid ${T3.sig};
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }
    @supports not (color: oklch(0 0 0)) {
      html, body { background: #1f2428 !important; color: #e4e6e8 !important; }
    }
    body { background: ${T3.bg0}; color: ${T3.fg1}; font-family: ${T3.fontUI}; -webkit-font-smoothing: antialiased; margin: 0; }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: ${T3.line1}; border-radius: 5px; border: 2px solid transparent; background-clip: padding-box; }
    ::-webkit-scrollbar-track { background: transparent; }
    textarea::placeholder, input::placeholder { color: ${T3.fg4}; }
    @keyframes chronusSweep { 0% { left: 0 } 100% { left: 100% } }
    @keyframes chronusProg { 0% { left: -40% } 100% { left: 100% } }
  `;
  document.head.appendChild(s);
}
