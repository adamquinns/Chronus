import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ApiKeyGateway } from './components/ApiKeyGateway';
import { ConsultCabinetModal } from './components/ConsultCabinetModal';
import { Debrief } from './components/Debrief';
import { GameConsole } from './components/GameConsole';
import { JournalDrawer } from './components/JournalDrawer';
import { ResolvingScreen } from './components/ResolvingScreen';
import { SavedCampaignSummary, ScenarioMenu } from './components/ScenarioMenu';
import { Campaign, DirectiveRevisionError, EntityState, PlayerForecast, TurnOption, TurnPreview, TurnProgress } from './engine/domain';
import { generateCustomScenario } from './engine/authoring';
import { MODEL_PRESETS, ModelPresetName, OpenRouterGateway } from './engine/model';
import { generateTurnOptions } from './engine/options';
import { attachForecast } from './engine/forecast';
import { runTurn } from './engine/pipeline';
import { createCampaign } from './engine/scenarios';
import { deleteCampaign, exportCampaign, getSetting, importCampaign, listCampaigns, loadCampaign, saveCampaign, setSetting } from './engine/persistence';
import { buildConsoleModel, buildHistoryModel } from './engine/viewModel';
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
  const [demoMode, setDemoMode] = useState(false);
  const [screen, setScreen] = useState<Screen>(() => apiKey ? 'MENU' : 'GATEWAY');
  const [campaign, setCampaign] = useState<Campaign>();
  const [sessions, setSessions] = useState<SavedCampaignSummary[]>([]);
  const [options, setOptions] = useState<TurnOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [directive, setDirective] = useState('');
  const [preview, setPreview] = useState<TurnPreview>();
  const [progress, setProgress] = useState<TurnProgress[]>([]);
  const [pendingCampaign, setPendingCampaign] = useState<Campaign>();
  const [error, setError] = useState<string>();
  const [journalOpen, setJournalOpen] = useState(false);
  const [revisionNotice, setRevisionNotice] = useState<string>();
  const forecastRef = useRef<PlayerForecast>();
  const pendingResult = useRef<Awaited<ReturnType<typeof runTurn>>>();
  const [forecastSettled, setForecastSettled] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [consultAdvisorId, setConsultAdvisorId] = useState<string>();
  const [generating, setGenerating] = useState(false);
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [preset, setPreset] = useState<ModelPresetName>('standard');
  const [developerTurn, setDeveloperTurn] = useState(0);

  const gateway = useMemo(() => apiKey && !demoMode ? new OpenRouterGateway(apiKey, MODEL_PRESETS[preset], {
    maxUsd: 3,
    maxRequests: 18,
    maxInputTokens: 120_000,
    maxOutputTokens: 40_000,
  }) : undefined, [apiKey, demoMode, preset, campaign?.state.turn]);
  useEffect(() => {
    getSetting<ModelPresetName>('modelPreset')
      .then((stored) => { if (stored && stored in MODEL_PRESETS) setPreset(stored); })
      .catch(console.error);
  }, []);
  const developerEnabled = isDeveloperAuditEnabled(import.meta.env.DEV, import.meta.env.VITE_ENABLE_DEVELOPER_AUDIT);

  const refreshSessions = async () => setSessions((await listCampaigns()).filter((item) => ['cuban_missile_crisis_black_saturday', 'american_twilight'].some((scenarioId) => item.id.startsWith(scenarioId === 'cuban_missile_crisis_black_saturday' ? 'cmc_' : scenarioId)) || ['Midnight in Havana', 'Twilight of the Republic'].includes(item.title)));
  useEffect(() => { refreshSessions().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not read saved campaigns.')); }, []);

  useEffect(() => {
    if (!campaign || screen !== 'PLAYING' || campaign.state.gameOver) return;
    let active = true;
    setLoadingOptions(true);
    generateTurnOptions(campaign, gateway).then((items) => { if (active) setOptions(items); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not generate options.'); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [campaign, gateway, screen]);

  const begin = async (scenarioId: string) => {
    try {
      const next = createCampaign(scenarioId);
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
    try {
      const result = await runTurn(campaign, text.trim(), {
        gateway,
        persist: true,
        storage: { save: saveCampaign },
        onPreview: setPreview,
        onProgress: (item) => setProgress((current) => [...current.filter((entry) => entry.stage !== item.stage), item]),
      });
      pendingResult.current = result;
      setPendingCampaign(result.campaign);
    } catch (caught) {
      if (caught instanceof DirectiveRevisionError || (caught as { kind?: string })?.kind === 'DIRECTIVE_REVISION') {
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
    const settled = forecastRef.current && pendingResult.current
      ? attachForecast(pendingResult.current, forecastRef.current).campaign
      : pendingCampaign;
    if (forecastRef.current && pendingResult.current) await saveCampaign(settled).catch(console.error);
    setCampaign(settled);
    setPendingCampaign(undefined);
    setOptions([]);
    setScreen('PLAYING');
    await refreshSessions();
  };

  const custom = async (prompt: string) => {
    if (!gateway) return;
    setGenerating(true);
    setError(undefined);
    try {
      const next = await generateCustomScenario(prompt, gateway);
      await saveCampaign(next);
      setCampaign(next);
      setScreen('PLAYING');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Custom scenario validation failed.'); }
    finally { setGenerating(false); }
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

  if (screen === 'GATEWAY') return <ApiKeyGateway onUnlock={(key) => { setApiKey(key); setDemoMode(false); setScreen('MENU'); }} onDemo={() => { setDemoMode(true); setScreen('MENU'); }} />;

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

  const model = buildConsoleModel(campaign, options);

  if (screen === 'RESOLVING') return <><ResolvingScreen
    directive={directive}
    preview={preview}
    progress={progress}
    resolved={Boolean(pendingCampaign)}
    error={error}
    morningPaper={campaign?.audits.at(-1)?.narrative.pressCoverage}
    forecastActors={Object.values<EntityState>(campaign.state.entities)
      .filter((entity) => entity.id !== campaign.state.manifest.playerId && entity.status === 'ACTIVE')
      .slice(0, 2)
      .map((entity) => ({ id: entity.id, name: entity.name }))}
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

  const history = buildHistoryModel(campaign);
  if (campaign.state.gameOver && model.goalResult) return <Debrief
    result={model.goalResult}
    history={history}
    finalTurn={model}
    campaign={campaign}
    hasNextGoal={Boolean(campaign.state.goal.successors?.length)}
    onReplay={() => begin(campaign.state.manifest.id)}
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
        ${campaign.audits.reduce((sum, audit) => sum + audit.estimatedCostUsd, 0).toFixed(2)}
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
      <button onClick={() => download(`chronus-${campaign.state.campaignId}.json`, exportCampaign(campaign))} style={utilityButton}>Export</button>
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
  const audit = campaign.audits[selected] ?? campaign.audits.at(-1);
  return <div style={{ position: 'fixed', inset: 0, zIndex: T3.zModal, background: T3.bg0, color: T3.fg1, padding: T3.sp5, overflow: 'auto', fontFamily: T3.fontMono }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: T3.sp3 }}><strong style={{ color: T3.neg }}>DEVELOPER MODE — FULL SPOILER AUDIT</strong><button onClick={onClose} style={utilityButton}>Close</button></div>
    <div style={{ display: 'flex', gap: 6, margin: `${T3.sp4} 0`, flexWrap: 'wrap' }}>{campaign.audits.map((item, index) => <button key={item.id} onClick={() => onSelect(index)} style={{ ...utilityButton, color: index === selected ? T3.sig : T3.fg2 }}>Turn {item.turn}</button>)}</div>
    {audit ? <pre style={{ whiteSpace: 'pre-wrap', fontSize: T3.s10 }}>{JSON.stringify(audit, null, 2)}</pre> : <p>No committed audits yet.</p>}
  </div>;
};

export default App;
