import React, { useEffect, useState } from 'react';
import { T3 } from '../theme';
import { Label, Speaker, Button } from './ui/Primitives';
import { TurnData } from '../types';
import { Campaign } from '../engine/domain';
import { ModelGateway } from '../engine/model';
import { consultAdvisors } from '../engine/advisors';

interface ConsultCabinetModalProps {
  turn: TurnData;
  campaign: Campaign;
  gateway?: ModelGateway;
  initialAdvisorId?: string;
  onClose: () => void;
}

type Turn = { q: string; a: string | null; loading: boolean; error: string | null };

export const ConsultCabinetModal: React.FC<ConsultCabinetModalProps> = ({
  turn, campaign, gateway, initialAdvisorId, onClose,
}) => {
  const [activeId, setActiveId] = useState<string | null>(initialAdvisorId ?? null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reset conversation when switching advisors.
  useEffect(() => { setTurns([]); setQuestion(''); }, [activeId]);

  const active = turn.advisors.find(a => a.id === activeId) ?? null;

  const ask = async () => {
    if (!active || !question.trim()) return;
    const q = question.trim();
    setQuestion('');
    const idx = turns.length;
    setTurns(t => [...t, { q, a: null, loading: true, error: null }]);

    try {
      const assessments = await consultAdvisors(campaign, q, gateway);
      const answer = assessments.find((assessment) => assessment.advisorId === active.id)?.assessment
        ?? `${active.name} has no further assessment.`;
      setTurns(t => {
        const next = [...t];
        next[idx] = { q, a: answer, loading: false, error: null };
        return next;
      });
    } catch (err: any) {
      console.error('Advisor consult failed:', err);
      const msg = summariseError(err);
      setTurns(t => {
        const next = [...t];
        next[idx] = { q, a: null, loading: false, error: msg };
        return next;
      });
    }
  };

  const retryTurn = async (idx: number) => {
    const failed = turns[idx];
    if (!failed || !active) return;
    setTurns(t => {
      const next = [...t];
      next[idx] = { ...next[idx], loading: true, error: null };
      return next;
    });
    try {
      const assessments = await consultAdvisors(campaign, failed.q, gateway);
      const answer = assessments.find((assessment) => assessment.advisorId === active.id)?.assessment
        ?? `${active.name} has no further assessment.`;
      setTurns(t => {
        const next = [...t];
        next[idx] = { q: failed.q, a: answer, loading: false, error: null };
        return next;
      });
    } catch (err: any) {
      console.error('Advisor consult retry failed:', err);
      const msg = summariseError(err);
      setTurns(t => {
        const next = [...t];
        next[idx] = { q: failed.q, a: null, loading: false, error: msg };
        return next;
      });
    }
  };

// Most Gemini errors surface as a stringified JSON blob. Pull out the
// human-readable message if we can, otherwise truncate.
function summariseError(err: any): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Match the "message":"..." field from a typical Google API error.
  const m = raw.match(/"message"\s*:\s*"([^"]{1,160})"/);
  if (m) return m[1];
  // Also try to find a status code label.
  const s = raw.match(/"status"\s*:\s*"([A-Z_]+)"/);
  if (s) return s[1].replace(/_/g, ' ').toLowerCase();
  return raw.length > 160 ? raw.slice(0, 160) + '…' : raw;
}

  const lastName = active ? active.name.split(' ').slice(-1)[0] : '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: T3.zModal,
      display: 'grid', placeItems: 'center', padding: T3.sp4,
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
      }} />
      <div role="dialog" aria-label="Consult cabinet" style={{
        position: 'relative', width: 'min(680px, 100%)', maxHeight: '85vh',
        background: T3.bg1, border: `1px solid ${T3.line2}`, borderRadius: T3.r4,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: T3.fontUI,
      }}>
        <header style={{
          padding: `${T3.sp4} ${T3.sp5}`, borderBottom: `1px solid ${T3.line1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <Label>Consult Cabinet</Label>
            <div style={{
              fontSize: T3.s15, color: T3.fg0, fontWeight: 600, marginTop: 2,
            }}>{active ? active.name : 'Select an advisor to consult'}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: `1px solid ${T3.line2}`, borderRadius: T3.r1,
              padding: '4px 9px', color: T3.fg2, cursor: 'pointer', fontSize: T3.s12,
            }}
          >Close</button>
        </header>

        <div style={{
          flex: 1, overflow: 'auto', padding: T3.sp5,
          display: 'flex', flexDirection: 'column', gap: T3.sp4,
        }}>
          {!active ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: T3.sp3 }}>
              {turn.advisors.map(a => (
                <button
                  key={a.id}
                  onClick={() => a.status !== 'Deceased' && setActiveId(a.id)}
                  disabled={a.status === 'Deceased'}
                  style={{
                    textAlign: 'left', background: 'transparent', border: 'none', padding: 0,
                    cursor: a.status === 'Deceased' ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Speaker name={a.name} role={a.role} bias={a.bias} status={a.status}>
                    {a.advice}
                  </Speaker>
                </button>
              ))}
            </div>
          ) : (
            <>
              <Speaker name={active.name} role={active.role} bias={active.bias} status={active.status}>
                {active.advice}
              </Speaker>

              {turns.map((t, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: T3.sp2 }}>
                  <div style={{
                    fontSize: T3.s10, color: T3.fg3,
                    letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
                  }}>You asked</div>
                  <div style={{
                    fontFamily: T3.fontProse, fontSize: T3.s14, color: T3.fg1,
                    borderLeft: `2px solid ${T3.line2}`, paddingLeft: T3.sp3, fontStyle: 'italic',
                  }}>{t.q}</div>

                  {t.loading && (
                    <div style={{
                      fontSize: T3.s12, color: T3.fg3, fontFamily: T3.fontMono,
                      letterSpacing: '0.08em',
                    }}>Consulting {lastName}…</div>
                  )}

                  {t.error && (
                    <div role="alert" style={{
                      display: 'flex', gap: T3.sp3, alignItems: 'center',
                      fontSize: T3.s12, color: T3.neg, fontFamily: T3.fontMono,
                    }}>
                      <span>Comm-link disrupted: {t.error}</span>
                      <button
                        onClick={() => retryTurn(i)}
                        style={{
                          fontFamily: T3.fontUI, fontSize: T3.s11, fontWeight: 600,
                          letterSpacing: '0.06em',
                          background: 'transparent', border: `1px solid ${T3.line2}`,
                          borderRadius: T3.r1, padding: '3px 8px',
                          color: T3.fg1, cursor: 'pointer',
                        }}
                      >Retry</button>
                    </div>
                  )}

                  {t.a && (
                    <div style={{
                      background: T3.bg2, borderLeft: `3px solid ${(T3 as any)[active.bias] || T3.fg3}`,
                      padding: T3.sp3, borderRadius: T3.r2,
                      fontFamily: T3.fontProse, fontSize: T3.s14, lineHeight: 1.55,
                      color: T3.fg1, fontStyle: 'italic', textWrap: 'pretty' as any,
                    }}>&ldquo;{t.a}&rdquo;</div>
                  )}
                </div>
              ))}

              <div>
                <Label>Ask a question</Label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); }
                  }}
                  placeholder="e.g. Given the current stats, what do you actually recommend?"
                  style={{
                    width: '100%', marginTop: T3.sp2, background: T3.bg2,
                    border: `1px solid ${T3.line2}`, borderRadius: T3.r3,
                    padding: T3.sp3, minHeight: 90, resize: 'vertical',
                    fontFamily: T3.fontProse, fontSize: T3.s14, color: T3.fg0, outline: 'none',
                  }}
                />
                <div style={{
                  fontSize: T3.s11, color: T3.fg3, marginTop: 4,
                  fontFamily: T3.fontMono, letterSpacing: '0.04em',
                }}>⌘↵ to send</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: T3.sp2 }}>
                <Button onClick={() => setActiveId(null)}>← Back to cabinet</Button>
                <Button primary disabled={!question.trim()} onClick={ask}>
                  Ask {lastName} →
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
