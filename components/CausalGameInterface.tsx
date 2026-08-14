import React, { useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, BrainCircuit, ChevronDown, ChevronUp, Database, Download,
  Eye, FileSearch, Globe2, Loader2, LogOut, Play, Save, ShieldCheck, Sparkles,
} from 'lucide-react';
import { Campaign, EntityState, TurnProgress } from '../engine/domain';
import { ModelGateway } from '../engine/model';
import { runTurn } from '../engine/pipeline';
import { exportCampaign } from '../engine/persistence';

interface Props {
  initialCampaign: Campaign;
  gateway?: ModelGateway;
  onCampaignChange: (campaign: Campaign) => void;
  onExit: () => void;
}

const suggestions = [
  'Delay retaliation. Use the Robert Kennedy–Dobrynin backchannel to offer a public non-invasion pledge and privately signal eventual Jupiter missile removal from Turkey.',
  'Authorize a limited strike on the SAM site that killed Major Anderson while keeping the quarantine in place.',
  'Pause low-level reconnaissance, tighten civilian control over field commands, and send Khrushchev an urgent proposal for reciprocal verified stand-down measures.',
];

const downloadText = (name: string, text: string) => {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const CausalGameInterface: React.FC<Props> = ({ initialCampaign, gateway, onCampaignChange, onExit }) => {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [directive, setDirective] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<TurnProgress[]>([]);
  const [error, setError] = useState<string>();
  const [showLedger, setShowLedger] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const latest = campaign.audits.at(-1);
  const metrics = campaign.state.manifest.metricDefinitions.filter((item) => !item.hidden);

  const knownFacts = useMemo(() => campaign.beliefs.player.knownFactIds
    .map((id) => campaign.state.facts[id])
    .filter(Boolean), [campaign]);

  const execute = async () => {
    if (!directive.trim() || running) return;
    setRunning(true);
    setError(undefined);
    setProgress([]);
    try {
      const result = await runTurn(campaign, directive, {
        gateway,
        persist: true,
        onProgress: (item) => setProgress((current) => [...current.filter((entry) => entry.stage !== item.stage), item]),
      });
      setCampaign(result.campaign);
      onCampaignChange(result.campaign);
      setDirective('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Turn resolution failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="sticky top-0 z-30 bg-gray-950/95 border-b border-gray-800 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="mr-auto">
            <div className="font-mono text-emerald-400 font-bold tracking-widest">CHRONUS</div>
            <div className="text-xs text-gray-500">{campaign.state.dateLabel} · Turn {campaign.state.turn}</div>
          </div>
          <button onClick={() => setShowLedger(!showLedger)} className="p-2 text-gray-400 hover:text-white" title="World ledger"><Database size={18}/></button>
          <button onClick={() => setDeveloperMode(!developerMode)} className={`p-2 ${developerMode ? 'text-amber-400' : 'text-gray-400'} hover:text-white`} title="Developer/declassification mode"><FileSearch size={18}/></button>
          <button onClick={() => downloadText(`chronus-${campaign.state.campaignId}.json`, exportCampaign(campaign))} className="p-2 text-gray-400 hover:text-white" title="Export campaign"><Download size={18}/></button>
          <button onClick={onExit} className="p-2 text-gray-400 hover:text-white" title="Exit"><LogOut size={18}/></button>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 grid grid-cols-2 md:grid-cols-6 gap-2">
          {metrics.map((definition) => {
            const value = campaign.state.metrics[definition.id];
            const danger = (definition.dangerAbove !== undefined && value >= definition.dangerAbove) || (definition.dangerBelow !== undefined && value <= definition.dangerBelow);
            return <div key={definition.id} className="bg-gray-900 border border-gray-800 rounded p-2">
              <div className="text-[10px] text-gray-500 uppercase font-mono truncate">{definition.label}</div>
              <div className={`text-lg font-mono font-bold ${danger ? 'text-red-400' : 'text-emerald-400'}`}>{value}</div>
            </div>;
          })}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-blue-400 mb-2"><ShieldCheck size={14}/> Active objective</div>
          <h2 className="text-xl font-bold">{campaign.state.goal.title}</h2>
          <p className="text-gray-400 mt-1">{campaign.state.goal.description}</p>
          <div className="text-xs text-gray-500 mt-3">Deadline: turn {campaign.state.goal.deadlineTurn} · Status: {campaign.state.goal.status}</div>
        </section>

        {!latest ? (
          <section className="bg-gray-900 border border-emerald-900/40 rounded-xl p-6 shadow-xl">
            <div className="text-xs font-mono text-red-400 uppercase tracking-widest mb-3">Top Secret // Eyes Only</div>
            <h1 className="text-3xl font-serif font-bold text-emerald-100 mb-4">Black Saturday</h1>
            <p className="text-gray-300 leading-relaxed">Major Rudolf Anderson Jr. is dead. The Joint Chiefs want retaliation against the Cuban air defenses, Soviet forces are operating under dangerous communication delays, and two incompatible messages from Moscow have opened a narrow diplomatic path. You know the crisis is near its breaking point. You do not know the full extent of Soviet nuclear capability in Cuba or at sea.</p>
          </section>
        ) : (
          <section className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono uppercase tracking-widest"><Archive size={14}/> Committed history</div>
            <h1 className="text-3xl font-serif font-bold text-emerald-100">{latest.narrative.title}</h1>
            <div><h3 className="text-xs text-blue-400 uppercase font-mono mb-2">Immediate outcome</h3><p className="text-gray-300 leading-relaxed">{latest.narrative.immediateOutcome}</p></div>
            <div><h3 className="text-xs text-blue-400 uppercase font-mono mb-2">World reaction</h3><p className="text-gray-300 leading-relaxed">{latest.narrative.worldReaction}</p></div>
            <div><h3 className="text-xs text-blue-400 uppercase font-mono mb-2">Strategic consequences</h3><p className="text-gray-300 leading-relaxed">{latest.narrative.strategicConsequences}</p></div>
            <button onClick={() => setShowWhy(!showWhy)} className="flex items-center gap-2 text-sm font-mono text-amber-400 hover:text-amber-300">
              <Eye size={15}/> Why did this happen? {showWhy ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
            </button>
            {showWhy && <div className="bg-black/30 border border-gray-800 rounded p-4 space-y-3">
              <p className="text-sm text-gray-300">{latest.adjudication.summary}</p>
              {latest.stateChanges.map((change) => <div key={change.id} className="text-xs font-mono text-gray-400 border-l-2 border-amber-800 pl-3">
                {change.targetId}: {String(change.before)} → {String(change.after)} · {change.cause}
              </div>)}
              <p className="text-[11px] text-gray-600">This view reveals attributable committed effects, but not hidden facts the player has not learned.</p>
            </div>}
          </section>
        )}

        {showLedger && <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="flex items-center gap-2 font-mono text-emerald-400 mb-4"><Globe2 size={18}/> STRATEGIC LEDGER</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {(Object.values(campaign.state.entities) as EntityState[]).map((entity) => <div key={entity.id} className="bg-gray-950 border border-gray-800 rounded p-3">
              <div className="font-bold">{entity.name}</div><div className="text-xs text-gray-500">{entity.kind} · {entity.status}</div>
              <p className="text-sm text-gray-400 mt-2">{entity.description}</p>
            </div>)}
          </div>
          <div className="mt-5"><div className="text-xs uppercase font-mono text-blue-400 mb-2">Known facts</div>{knownFacts.map((fact) => <p key={fact.id} className="text-sm text-gray-400 mb-1">• {fact.statement} <span className="text-gray-600">({fact.confidence})</span></p>)}</div>
        </section>}

        {developerMode && latest && <section className="bg-black border border-amber-900/50 rounded-xl p-5 font-mono text-xs overflow-auto">
          <div className="text-amber-400 mb-3">DECLASSIFIED DEVELOPER AUDIT</div>
          <pre className="text-gray-400 whitespace-pre-wrap">{JSON.stringify(latest, null, 2)}</pre>
        </section>}

        <section className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-purple-400 mb-3"><BrainCircuit size={15}/> Set your strategy for this period</div>
          <p className="text-sm text-gray-500 mb-4">Give one order or a coordinated plan. Chronus will determine what can realistically be attempted before the world moves again.</p>
          <div className="grid gap-2 mb-4">
            {suggestions.map((item) => <button key={item} onClick={() => setDirective(item)} disabled={running} className="text-left text-sm bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded p-3 text-gray-400 transition-colors">{item}</button>)}
          </div>
          <textarea value={directive} onChange={(event) => setDirective(event.target.value)} disabled={running || campaign.state.gameOver} rows={5} placeholder="Describe any plausible strategy available to your role…" className="w-full bg-black border border-gray-700 rounded-lg p-4 text-gray-200 focus:border-emerald-500 focus:outline-none resize-y"/>
          {error && <div className="mt-3 text-sm text-red-400 flex gap-2"><AlertTriangle size={17}/>{error}</div>}
          {running && <div className="mt-4 bg-black/30 rounded p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-mono"><Loader2 className="animate-spin" size={16}/> Deep simulation in progress</div>
            {progress.map((item) => <div key={item.stage} className="text-xs text-gray-500"><span className="text-gray-300">✓ {item.label}</span>{item.detail ? ` — ${item.detail}` : ''}</div>)}
          </div>}
          <button onClick={execute} disabled={!directive.trim() || running || campaign.state.gameOver} className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold font-mono rounded flex items-center justify-center gap-2">
            {running ? <Loader2 className="animate-spin" size={18}/> : gateway ? <Sparkles size={18}/> : <Play size={18}/>} Commit strategy
          </button>
          {!gateway && <p className="text-center text-xs text-amber-500 mt-2">Deterministic demo mode: no model judgment or narrative calls.</p>}
        </section>
      </main>
    </div>
  );
};
