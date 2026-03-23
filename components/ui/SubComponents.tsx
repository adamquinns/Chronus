import React, { useState } from 'react';
import { TurnData, HistoryEntry, Choice, WorldLedger, Advisor, NewsFlash, ExecutionAnalysis, Entity, PlotArc, Goal, GoalResult } from '../../types';
import { consultAdvisor } from '../../services/geminiService';
import { getRiskConfig, getOutcomeRanges } from '../../services/mechanics';
import { Send, AlertTriangle, RefreshCw, Terminal, TrendingUp, TrendingDown, Minus, BookOpen, Globe, Gavel, User, Skull, Radio, Lock, MessageSquare, MessageCircle, CheckCircle, Percent, Target, FileText, Zap, Eye, EyeOff, Activity, ChevronRight, X, ChevronDown, Clock, ShieldAlert, Swords, HeartHandshake, Briefcase, Flag, PlayCircle, LogOut, Dices } from 'lucide-react';

// --- EXPORTED SUB-COMPONENTS ---
export const MissionDebriefModal: React.FC<{ 
    result: GoalResult, 
    nextGoal: Goal,
    onContinue: () => void, 
    onTerminate: () => void 
}> = ({ result, nextGoal, onContinue, onTerminate }) => {
    const isVictory = result.outcome === 'VICTORY';
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
            <div className={`max-w-2xl w-full bg-gray-900 border-2 ${isVictory ? 'border-emerald-500' : 'border-red-600'} rounded-lg shadow-2xl relative overflow-hidden flex flex-col`}>
                
                {/* Header */}
                <div className={`p-6 ${isVictory ? 'bg-emerald-900/20' : 'bg-red-900/20'} border-b ${isVictory ? 'border-emerald-900/50' : 'border-red-900/50'}`}>
                    <div className="flex items-center gap-4 mb-2">
                        {isVictory ? <CheckCircle size={32} className="text-emerald-500" /> : <ShieldAlert size={32} className="text-red-500" />}
                        <h2 className={`text-2xl font-bold font-mono tracking-widest ${isVictory ? 'text-emerald-400' : 'text-red-500'}`}>
                            {result.title.toUpperCase()}
                        </h2>
                    </div>
                    <p className={`text-sm font-bold uppercase tracking-wide ${isVictory ? 'text-emerald-700' : 'text-red-700'}`}>
                        MISSION {result.outcome}
                    </p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div>
                        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Outcome Analysis</h3>
                        <p className="text-lg text-gray-200 leading-relaxed border-l-2 border-gray-700 pl-4">
                            {result.description}
                        </p>
                    </div>

                    <div className="bg-black/40 rounded p-4 border border-gray-800">
                        <h3 className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Target size={14} /> New Objective Assigned
                        </h3>
                        <p className="text-white font-bold">{nextGoal.description}</p>
                        <p className="text-xs text-gray-500 mt-1 italic">Victory Condition: {nextGoal.victoryCondition}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-gray-950 border-t border-gray-800 flex gap-4">
                    <button 
                        onClick={onTerminate}
                        className="flex-1 py-4 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/50 rounded transition-all uppercase tracking-wider flex items-center justify-center gap-2 group"
                    >
                        <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Terminate Timeline
                    </button>
                    <button 
                        onClick={onContinue}
                        className={`flex-[2] py-4 text-sm font-bold text-black rounded transition-all uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-xl ${isVictory ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-900/20' : 'bg-gray-200 hover:bg-white shadow-gray-900/20'}`}
                    >
                        <PlayCircle size={16} />
                        Accept New Mission
                    </button>
                </div>
            </div>
        </div>
    );
};

export const GoalTracker: React.FC<{ goal: Goal, timeUnit: string }> = ({ goal, timeUnit }) => {
    const percent = Math.max(0, Math.min(100, (goal.turnsRemaining / goal.totalTurns) * 100));
    
    // Determine color based on urgency
    let timerColor = "text-emerald-500";
    if (percent < 50) timerColor = "text-yellow-500";
    if (percent < 20) timerColor = "text-red-500 animate-pulse";

    return (
        <div className="bg-black/60 border-y border-gray-800 p-4 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Flag size={80} />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex-grow">
                    <h4 className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <Target size={12} /> Primary Mission Objective
                    </h4>
                    <h3 className="text-lg font-bold text-gray-100">{goal.description}</h3>
                    <p className="text-xs text-gray-500 mt-1 italic">Victory Condition: {goal.victoryCondition}</p>
                </div>
                
                <div className="min-w-[150px] bg-gray-900 rounded p-3 border border-gray-800 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Deadline</span>
                    <div className={`text-2xl font-mono font-bold ${timerColor}`}>
                        {goal.turnsRemaining} <span className="text-xs text-gray-600">{timeUnit}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const EntityCard: React.FC<{ entity: Entity, type: 'Ally' | 'Enemy' | 'Asset' }> = ({ entity, type }) => {
    let borderColor = "border-gray-700";
    let icon = <Globe size={16} />;
    
    if (type === 'Ally') { borderColor = "border-blue-900/50"; icon = <HeartHandshake size={16} className="text-blue-400" />; }
    if (type === 'Enemy') { borderColor = "border-red-900/50"; icon = <Swords size={16} className="text-red-400" />; }
    if (type === 'Asset') { borderColor = "border-emerald-900/50"; icon = <Briefcase size={16} className="text-emerald-400" />; }

    return (
        <div className={`bg-black/30 border ${borderColor} rounded p-3 flex flex-col gap-2`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-bold text-gray-200">{entity.name}</span>
                </div>
                <span className="text-[10px] text-gray-500 uppercase bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">{entity.status}</span>
            </div>
            <p className="text-xs text-gray-500 italic leading-tight">{entity.description}</p>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-gray-500 uppercase">
                        <span>Power</span>
                        <span>{entity.power}%</span>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-400" style={{ width: `${entity.power}%` }}></div>
                    </div>
                </div>
                {type !== 'Enemy' && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500 uppercase">
                            <span>Loyalty</span>
                            <span>{entity.loyalty}%</span>
                        </div>
                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div className={`h-full ${entity.loyalty < 40 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${entity.loyalty}%` }}></div>
                        </div>
                    </div>
                )}
                {type === 'Enemy' && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500 uppercase">
                            <span>Threat</span>
                            <span>{entity.loyalty > 50 ? 'DORMANT' : 'ACTIVE'}</span>
                        </div>
                         <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-red-500" style={{ width: `${100 - entity.loyalty}%` }}></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ArcTracker: React.FC<{ arcs: PlotArc[] }> = ({ arcs }) => {
    if (!arcs || arcs.length === 0) return null;
    return (
        <div className="bg-gray-900/50 border-y border-gray-800 p-4 mb-6">
            <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Clock size={12} /> Active Storylines
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {arcs.map(arc => (
                    <div key={arc.id} className="space-y-1">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-gray-300">{arc.title}</span>
                            <span className="text-xs text-emerald-500 font-mono">{arc.currentValue}/{arc.maxValue}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                             <div 
                                className="h-full bg-gradient-to-r from-emerald-900 to-emerald-500 transition-all duration-1000 ease-out"
                                style={{ width: `${(arc.currentValue / arc.maxValue) * 100}%` }}
                             ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-600 uppercase">
                            <span>Status: {arc.status}</span>
                            <span>Climax at 100</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const LedgerPanel = ({ ledger }: { ledger: WorldLedger }) => (
  <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-6 mb-8 shadow-2xl animate-fade-in relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
       <Globe size={100} />
    </div>
    <h3 className="text-lg font-mono font-bold text-emerald-500 mb-6 flex items-center gap-2">
      <BookOpen size={18} /> STRATEGIC INTELLIGENCE LEDGER
    </h3>
    
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        <div>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <HeartHandshake size={14}/> Allies & Factions
            </h4>
            <div className="space-y-3">
                {ledger.allies.map(e => <EntityCard key={e.id} entity={e} type="Ally" />)}
            </div>
        </div>
        
        <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Briefcase size={14}/> Key Assets
            </h4>
            <div className="space-y-3">
                {ledger.assets.map(e => <EntityCard key={e.id} entity={e} type="Asset" />)}
            </div>
        </div>

        <div>
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ShieldAlert size={14}/> Hostiles & Threats
            </h4>
            <div className="space-y-3">
                {ledger.enemies.map(e => <EntityCard key={e.id} entity={e} type="Enemy" />)}
            </div>
        </div>
    </div>
  </div>
);

export const AdvisorCard: React.FC<{ advisor: Advisor; context: string }> = ({ advisor, context }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [dialogue, setDialogue] = useState<{q: string, a: string}[]>([]);

  let colorClass = "text-gray-400";
  let bgClass = "bg-gray-800";
  
  if (advisor.bias === 'force') { colorClass = "text-red-400"; bgClass = "bg-red-900/10"; }
  if (advisor.bias === 'diplomacy') { colorClass = "text-blue-400"; bgClass = "bg-blue-900/10"; }
  if (advisor.bias === 'profit') { colorClass = "text-yellow-400"; bgClass = "bg-yellow-900/10"; }
  if (advisor.bias === 'innovation') { colorClass = "text-purple-400"; bgClass = "bg-purple-900/10"; }

  const handleAsk = async () => {
    if (!question.trim() || isAsking) return;
    
    const currentQ = question;
    setQuestion('');
    setIsAsking(true);

    try {
      const answer = await consultAdvisor(advisor, context, currentQ);
      setDialogue(prev => [...prev, { q: currentQ, a: answer }]);
    } catch (e) {
      setDialogue(prev => [...prev, { q: currentQ, a: "I cannot answer that right now." }]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className={`bg-gray-900/80 border border-gray-800 rounded-lg transition-all duration-300 ${isExpanded ? 'shadow-xl ring-1 ring-gray-700' : ''}`}>
      <div className="p-4 flex items-start gap-4">
         <div className={`w-12 h-12 rounded-full flex items-center justify-center border border-gray-700 shrink-0 ${bgClass} ${colorClass}`}>
            <User size={24} />
         </div>
         <div className="flex-grow min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <h4 className={`text-sm font-bold ${colorClass} uppercase tracking-wider break-words`}>{advisor.role}</h4>
                <p className="text-xs text-gray-500 mb-2 truncate" title={advisor.name}>{advisor.name}</p>
              </div>
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-colors ${isExpanded ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`}
                title="Question Advisor"
              >
                {isExpanded ? <X size={14} /> : <MessageCircle size={14} />}
                {isExpanded ? "CLOSE" : "CONSULT"}
              </button>
            </div>
            
            <div className="bg-black/30 p-2 rounded text-sm italic text-gray-300 border-l-2 border-gray-700">
              "{advisor.advice}"
            </div>
         </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 animate-fade-in border-t border-gray-800/50 pt-3">
          <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
             {dialogue.map((entry, idx) => (
               <div key={idx} className="space-y-1 text-xs">
                  <div className="text-right text-gray-400 bg-gray-800/50 inline-block px-2 py-1 rounded ml-auto max-w-[90%]">
                    {entry.q}
                  </div>
                  <div className={`text-left ${colorClass} bg-black/40 px-2 py-1 rounded mr-auto max-w-[90%] border-l-2 border-gray-700`}>
                    "{entry.a}"
                  </div>
               </div>
             ))}
             {isAsking && (
               <div className="text-xs text-gray-500 animate-pulse italic">Thinking...</div>
             )}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask ${advisor.name}...`}
              className="flex-grow bg-gray-950 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            />
            <button 
              onClick={handleAsk}
              disabled={isAsking || !question.trim()}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 p-1.5 rounded disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const NewsTicker = ({ news }: { news: NewsFlash[] }) => (
  <div className="w-full bg-black/50 border-y border-gray-800 py-2 overflow-hidden mb-6 relative group">
     <div className="flex items-center gap-2 absolute left-0 top-0 bottom-0 z-10 bg-gradient-to-r from-gray-950 via-gray-950/90 to-transparent px-4">
       <Radio size={14} className="text-red-500 animate-pulse" />
       <span className="text-xs font-mono text-red-500 uppercase font-bold whitespace-nowrap">Live Wire</span>
     </div>
     <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-gray-950 to-transparent z-10 pointer-events-none"></div>
     <div className="overflow-hidden relative w-full h-6">
       <div className="animate-marquee whitespace-nowrap flex gap-12 absolute pl-32 hover:[animation-play-state:paused]">
         {[...news, ...news, ...news].map((n, i) => (
           <span key={i} className="text-sm font-mono text-gray-400 inline-flex items-center gap-2">
             <span className="text-emerald-700 font-bold">///</span>
             <span className="text-gray-500 font-bold uppercase text-xs tracking-wider">[{n.source}]</span> 
             <span className="text-gray-300">{n.headline.toUpperCase()}</span>
           </span>
         ))}
       </div>
     </div>
  </div>
);

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="group relative inline-block ml-2 align-middle">
    <div className="text-gray-500 hover:text-emerald-400 cursor-help rounded-full border border-gray-600 hover:border-emerald-400 w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold transition-colors">
      i
    </div>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 border border-emerald-900/50 text-gray-300 text-[10px] rounded shadow-xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all pointer-events-none z-50 normal-case tracking-normal">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-emerald-900/50"></div>
    </div>
  </div>
);

export const DeclassifiedReport = ({ analysis }: { analysis: ExecutionAnalysis }) => {
  const [isOpen, setIsOpen] = useState(false);

  let outcomeColor = "text-gray-300";
  if (analysis.outcomeCategory === 'VICTORY') outcomeColor = "text-emerald-400"; 
  else if (analysis.outcomeCategory === 'PARTIAL_SUCCESS') outcomeColor = "text-emerald-200"; 
  else if (analysis.outcomeCategory === 'PARTIAL_FAILURE') outcomeColor = "text-red-300"; 
  else if (analysis.outcomeCategory === 'CRITICAL_FAILURE') outcomeColor = "text-red-500"; 
  else {
      const label = analysis.outcomeLabel?.toLowerCase() || "";
      if (label.includes('success')) outcomeColor = "text-emerald-400";
      else if (label.includes('failure') || label.includes('collapse')) outcomeColor = "text-red-500";
      else outcomeColor = "text-yellow-400";
  }

  const riskConfig = getRiskConfig(analysis.perceivedRisk);
  const modifier = analysis.intelModifierValue || 0;

  return (
    <div className="mt-4 border-t border-gray-800 pt-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-black/40 hover:bg-black/60 rounded border border-gray-800 transition-colors group"
      >
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-gray-500 group-hover:text-emerald-500 transition-colors uppercase tracking-widest">
           <Terminal size={12} />
           {isOpen ? "Hide Declassified Metrics" : "View Declassified Metrics"}
        </div>
        <ChevronRight size={14} className={`text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-2 bg-black border border-gray-800 p-4 rounded font-mono text-xs shadow-inner animate-fade-in relative">
            <div className="absolute inset-0 overflow-hidden rounded pointer-events-none">
                <div className="absolute top-0 right-0 p-2 opacity-20">
                    <Activity size={48} className="text-emerald-500" />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 relative z-10">
                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Directive Class <InfoTooltip text="The type of action taken. Custom inputs use 'CUSTOM PROTOCOL'." />
                    </span>
                    <span className={`font-bold ${analysis.directiveType === 'CUSTOM' ? 'text-blue-400 animate-pulse' : 'text-gray-300'}`}>
                        {analysis.directiveType} PROTOCOL
                    </span>
                </div>
                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Calculated Outcome <InfoTooltip text="The final narrative result computed by the simulation." />
                    </span>
                    <span className={`font-bold ${outcomeColor} uppercase`}>{analysis.outcomeLabel}</span>
                </div>
                
                <div className="col-span-2 h-px bg-gray-900"></div>

                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Assessed Risk <InfoTooltip text="The base difficulty. Higher risk requires higher rolls to succeed and carries harsher penalties for failure." />
                    </span>
                    <span className={`font-bold uppercase ${analysis.perceivedRisk === 'EXTREME' || analysis.perceivedRisk === 'HIGH' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {analysis.perceivedRisk}
                    </span>
                </div>
                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Target Threshold <InfoTooltip text="The number you must meet or exceed on a 20-sided die (d20) to achieve a Victory. The 'Effective' threshold includes your modifiers." />
                    </span>
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-300">Base: {riskConfig.threshold}+</span>
                        {modifier !== 0 && (
                            <span className={modifier > 0 ? "text-red-400" : "text-emerald-400"}>
                                Effective: {Math.max(0, Math.min(19, riskConfig.threshold + modifier))}+
                            </span>
                        )}
                    </div>
                </div>

                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Intel Variance <InfoTooltip text="Modifiers applied to your roll threshold based on your current stats, assets, and situational advantages." />
                    </span>
                    {modifier === 0 ? (
                        <span className="text-gray-500">None</span>
                    ) : (
                        <span className={`font-bold ${modifier > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {modifier > 0 ? `+${modifier} (Harder)` : `${modifier} (Easier)`}
                        </span>
                    )}
                </div>

                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Resolution Roll <InfoTooltip text="A simulated 20-sided die (d20). 1 is a Critical Failure, 20 is a Critical Success." />
                    </span>
                    <span className="font-bold text-white flex items-center gap-2">
                        <Dices size={14} className="text-emerald-500" /> {analysis.rollValue}
                    </span>
                </div>
                <div className="col-span-2">
                    <span className="text-gray-600 uppercase tracking-wider block mb-1 flex items-center">
                        Resource Consumption <InfoTooltip text="The material, political, or social cost of taking this action, regardless of success." />
                    </span>
                    <span className="font-bold text-gray-400">{analysis.resourcesConsumed}</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

