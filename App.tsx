import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyGateway } from './components/ApiKeyGateway';
import { ConsultCabinetModal } from './components/ConsultCabinetModal';
import { Debrief } from './components/Debrief';
import { GameConsole } from './components/GameConsole';
import { JournalDrawer } from './components/JournalDrawer';
import { ResolvingScreen } from './components/ResolvingScreen';
import { SavedCampaignSummary, ScenarioMenu } from './components/ScenarioMenu';
import { MODEL_PRESETS, ModelPresetName, OpenRouterGateway } from './engine/model';
import { LedgerGateway } from './engine/ledger/cassette';
import {
  Campaign,
  DirectiveRevisionNeeded,
  PlayerForecast,
  advanceTurn,
  consoleModel,
  consultAdvisors as askAdvisors,
  historyModel,
  scoreForecast,
  startCampaign,
  suggestDirectives,
} from './engine/ledger/api';
import { deleteCampaign, exportCampaign, getSetting, importCampaign, listCampaigns, loadCampaign, saveCampaign, setSetting } from './engine/ledger/persistence';
import { isDeveloperAuditEnabled } from './components/playerVisibility';
import { T3 } from './theme';

type Screen = 'GATEWAY' | 'MENU' | 'PLAYING' | 'RESOLVING';

const download = (name: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('chronus_openrouter_key') ?? '');
  const [screen, setScreen] = useState<Screen>(() => apiKey ? 'MENU' : 'GATEWAY');
  const [campaign, setCampaign] = useState<Campaign>();
  const [sessions, setSessions] = useState<SavedCampaignSummary[]>([]);
  const [options, setOptions] = useState<Array<{ id: string; label: string; directive: string; rationale: string; tradeoff: string }>>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [directive, setDirective] = useState('');
  const [preview, setPreview] = useState<{ strategy: string; advantages: string[]; uncertainties: string[]; stakes: string[]; advisorAssessments: string[]; intelligenceNotes: string[]; strategicTradeoffs: string[] }>();
  const [progress, setProgress] = useState<Array<{ stage: string; label: string; detail?: string; status: 'STARTED' | 'COMPLETED'; at: string }>>([]);
  const [pendingCampaign, setPendingCampaign] = useState<Campaign>();
  const [error, setError] = useState<string>();
  const [journalOpen, setJournalOpen] = useState(false);
  const [revisionNotice, setRevisionNotice] = useState<string>();
  const forecastRef = useRef<PlayerForecast | undefined>(undefined);
  const pendingResult = useRef<Campaign | undefined>(undefined);
  const [forecastSettled, setForecastSettled] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultAdvisorId, setConsultAdvisorId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [preset, setPreset] = useState<ModelPresetName>('standard');
  const [developerTurn, setDeveloperTurn] = useState(0);

  const gateway = useMemo(() => {
    if (!apiKey) return undefined;
    const model = new OpenRouterGateway(apiKey, MODEL_PRESETS[preset], {
      maxUsd: 3,
      maxRequests: 18,
      maxInputTokens: 120_000,
      maxOutputTokens: 40_000,
    });
    return new LedgerGateway({ mode: 'live', gateway: model });
  }, [apiKey, preset, campaign?.ledger.turn]);
  useEffect(() => {
    getSetting<ModelPresetName>('modelPreset')
      .then((stored) => { if (stored && stored in MODEL_PRESETS) setPreset(stored); })
      .catch(console.error);
  }, []);
  const developerEnabled = isDeveloperAuditEnabled(import.meta.env.DEV, import.meta.env.VITE_ENABLE_DEVELOPER_AUDIT);

  const refreshSessions = async () => setSessions(await listCampaigns());
  useEffect(() => { refreshSessions().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not read saved campaigns.')); }, []);

  useEffect(() => {
    if (!campaign || screen !== 'PLAYING' || campaign.ledger.concluded) return;
    let active = true;
    setLoadingOptions(true);
    if (!gateway) { setLoadingOptions(false); return; }
    suggestDirectives(campaign, gateway).then((items) => { if (active) setOptions(items); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not generate options.'); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [campaign, gateway, screen]);

  const begin = async (scenarioId: string) => {
    try {
      const next = startCampaign(scenarioId);
      await saveCampaign(next);
      setCampaign(next);
      setOptions([]);
      setError(undefined);
      setScreen('PLAYING');
      await refreshSessions();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not begin scenario.'); }
  };

  const resume = async (id: string) => {
    try {
      const next = await loadCampaign(id);
      if (!next) throw new Error('The selected campaign no longer exists.');
      setCampaign(next);
      setScreen('PLAYING');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not resume campaign.'); }
  };

  const resolve = async (text: string) => {
    if (!campaign || !text.trim()) return;
    setDirective(text.trim());
    setPreview(undefined);
    setProgress([]);
    setPendingCampaign(undefined);
    setError(undefined);
    setRevisionNotice(undefined);
    forecastRef.current = undefined;
    pendingResult.current = undefined;
    setForecastSettled(false);
    setScreen('RESOLVING');
    if (!gateway) { setError('Model access is required to resolve a turn.'); setScreen('PLAYING'); return; }
    try {
      const next = await advanceTurn(campaign, text.trim(), gateway, (event) => {
        setProgress((current) => [
          ...current.filter((entry) => entry.stage !== event.stage),
          { stage: event.stage, label: event.label, status: event.done ? 'COMPLETED' : 'STARTED', at: new Date().toISOString() },
        ]);
        // What the player knows going in, shown while the world works.
        if (event.stage === 'INTERPRET' && event.done) {
          setPreview({
            strategy: text.trim(),
            advantages: [],
            uncertainties: [],
            stakes: [],
            advisorAssessments: [],
            intelligenceNotes: [],
            strategicTradeoffs: [],
          });
        }
      });
      await saveCampaign(next);
      pendingResult.current = next;
      setPendingCampaign(next);
    } catch (caught) {
      if (caught instanceof DirectiveRevisionNeeded || (caught as { kind?: string })?.kind === 'DIRECTIVE_REVISION') {
        // Non-consuming: nothing advanced. Return to the console for revision.
        setRevisionNotice((caught as { playerMessage?: string }).playerMessage ?? (caught as Error).message);
        setScreen('PLAYING');
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Turn resolution failed.');
    }
  };

  const advance = async () => {
    if (!pendingCampaign) return;
    // Score the forecast only now — after resolution, before the player has
    // seen the outcome. Structurally cannot influence adjudication.
    // Scored only now: after resolution, before the player has seen the
    // outcome. It structurally cannot have influenced anything.
    const record = pendingCampaign.records.at(-1);
    if (forecastRef.current && record) {
      const scored = scoreForecast(record, forecastRef.current);
      console.info('forecast', scored.result, scored.predicted, '→', scored.actual);
    }
    setCampaign(pendingCampaign);
    setPendingCampaign(undefined);
    setOptions([]);
    setScreen('PLAYING');
    await refreshSessions();
  };

  const custom = async (_prompt: string) => {
    // Authoring a scenario from a prompt is a ledger-native feature that has
    // not been rebuilt yet; the two curated scenarios remain available.
    setError('Custom scenarios are not available in this build. Choose a curated scenario to begin.');
  };

  const importFile = async (file: File) => {
    try {
      const next = importCampaign(await file.text());
      await saveCampaign(next);
      setCampaign(next);
      setScreen('PLAYING');
      await refreshSessions();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Campaign import failed.'); }
  };

  if (screen === 'GATEWAY') return <ApiKeyGateway onUnlock={(key) => { setApiKey(key); setScreen('MENU'); }} />;

  if (screen === 'MENU') return <ScenarioMenu
    sessions={sessions}
    onSelect={begin}
    onResume={resume}
    onDelete={async (id) => { await deleteCampaign(id); await refreshSessions(); }}
    onImport={importFile}
    onCustom={custom}
    customEnabled={Boolean(gateway)}
    generating={generating}
    errorMessage={error}
    onChangeAccess={() => setScreen('GATEWAY')}
  />;

  if (!campaign) return null;

  const model = consoleModel(campaign, options);

  if (screen === 'RESOLVING') return <><ResolvingScreen
    directive={directive}
    preview={preview}
    progress={progress}
    resolved={Boolean(pendingCampaign)}
    error={error}
    morningPaper={campaign.records.at(-1)?.narration.press}
    forecastActors={campaign.ledger.cast
      .filter((member) => member.id !== campaign.ledger.playerId)
      .slice(0, 2)
      .map((member) => ({ id: member.id, name: member.name }))}
    forecastSubmitted={forecastSettled}
    onSubmitForecast={(value) => { forecastRef.current = value; setForecastSettled(true); }}
    onSkipForecast={() => setForecastSettled(true)}
    onOpenConsult={() => setConsultOpen(true)}
    onAdvance={advance}
    onRetry={() => resolve(directive)}
    onAbort={() => setScreen('PLAYING')}
  />
    {consultOpen && <ConsultCabinetModal
      turn={model}
      campaign={campaign}
      gateway={gateway}
      initialAdvisorId={consultAdvisorId}
      onClose={() => setConsultOpen(false)}
    />}
  </>;

  const history = historyModel(campaign);
  if (model.gameOver && model.goalResult) return <Debrief
    result={model.goalResult}
    history={history}
    finalTurn={model}
    hasNextGoal={false}
    onReplay={() => begin(campaign.ledger.scenarioId)}
    onNewScenario={() => setScreen('MENU')}
  />;

  return <>
    <GameConsole
      turn={model}
      historyCount={history.length}
      revisionNotice={revisionNotice}
      anyOverlayOpen={journalOpen || consultOpen || developerOpen}
      onCommit={({ choiceText }) => resolve(choiceText)}
      onOpenJournal={() => setJournalOpen(true)}
      onOpenConsult={(advisorId) => { setConsultAdvisorId(advisorId); setConsultOpen(true); }}
    />
    <div style={{ position: 'fixed', right: 12, bottom: 72, zIndex: T3.zSticky, display: 'flex', gap: 6 }}>
      <span title="Session model spend" style={{ ...utilityButton, cursor: 'default' }}>
        ${(gateway?.costUsd ?? 0).toFixed(2)}
      </span>
      <select
        aria-label="Model routing preset"
        value={preset}
        onChange={(event) => {
          const value = event.target.value as ModelPresetName;
          setPreset(value);
          setSetting('modelPreset', value).catch(console.error);
        }}
        style={{ ...utilityButton, cursor: 'pointer' }}
      >
        <option value="economy">Economy</option>
        <option value="standard">Standard</option>
        <option value="cinematic">Cinematic</option>
      </select>
      <button onClick={() => download(`chronus-${campaign.ledger.campaignId}.json`, exportCampaign(campaign))} style={utilityButton}>Export</button>
      {developerEnabled && <button onClick={() => setDeveloperOpen(true)} style={utilityButton}>Developer audit</button>}
      <button onClick={() => { setScreen('MENU'); refreshSessions().catch(console.error); }} style={utilityButton}>Timelines</button>
    </div>
    {loadingOptions && <div aria-live="polite" style={{ position: 'fixed', left: 12, bottom: 72, zIndex: T3.zSticky, color: T3.fg3, fontSize: T3.s11 }}>Preparing strategic options…</div>}
    {journalOpen && <JournalDrawer history={history} onClose={() => setJournalOpen(false)} />}
    {consultOpen && <ConsultCabinetModal turn={model} campaign={campaign} gateway={gateway} initialAdvisorId={consultAdvisorId} onClose={() => setConsultOpen(false)} />}
    {developerOpen && <DeveloperAudit campaign={campaign} selected={developerTurn} onSelect={setDeveloperTurn} onClose={() => setDeveloperOpen(false)} />}
  </>;
};

const utilityButton: React.CSSProperties = { background: T3.bg2, color: T3.fg2, border: `1px solid ${T3.line2}`, borderRadius: T3.r1, padding: '6px 9px', cursor: 'pointer', fontSize: T3.s10 };

const DeveloperAudit: React.FC<{ campaign: Campaign; selected: number; onSelect: (index: number) => void; onClose: () => void }> = ({ campaign, selected, onSelect, onClose }) => {
  const audit = campaign.records[selected] ?? campaign.records.at(-1);
  return <div style={{ position: 'fixed', inset: 0, zIndex: T3.zModal, background: T3.bg0, color: T3.fg1, padding: T3.sp5, overflow: 'auto', fontFamily: T3.fontMono }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: T3.sp3 }}><strong style={{ color: T3.neg }}>DEVELOPER MODE — FULL SPOILER AUDIT</strong><button onClick={onClose} style={utilityButton}>Close</button></div>
    <div style={{ display: 'flex', gap: 6, margin: `${T3.sp4} 0`, flexWrap: 'wrap' }}>{campaign.records.map((item, index) => <button key={item.turn} onClick={() => onSelect(index)} style={{ ...utilityButton, color: index === selected ? T3.sig : T3.fg2 }}>Turn {item.turn}</button>)}</div>
    {audit ? <pre style={{ whiteSpace: 'pre-wrap', fontSize: T3.s10 }}>{JSON.stringify(audit, null, 2)}</pre> : <p>No committed turns yet.</p>}
  </div>;
};

export default App;
