

import React, { useState, useRef, useEffect } from 'react';
import { TurnData, HistoryEntry, Choice, WorldLedger, Advisor, NewsFlash, ExecutionAnalysis, Entity, PlotArc, Goal, GoalResult } from '../types';
import { processTurn, consultAdvisor } from '../services/geminiService';
import { getRiskConfig, getOutcomeRanges } from '../services/mechanics';
import { StatBar } from './StatBar';
import { Send, AlertTriangle, RefreshCw, Terminal, TrendingUp, TrendingDown, Minus, BookOpen, Globe, Gavel, User, Skull, Radio, Lock, MessageSquare, MessageCircle, CheckCircle, Percent, Target, FileText, Zap, Eye, EyeOff, Activity, ChevronRight, X, ChevronDown, Clock, ShieldAlert, Swords, HeartHandshake, Briefcase, Flag, PlayCircle, LogOut, Dices } from 'lucide-react';

// --- SUB-COMPONENTS ---

const MissionDebriefModal: React.FC<{ 
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

const GoalTracker: React.FC<{ goal: Goal, timeUnit: string }> = ({ goal, timeUnit }) => {
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

const EntityCard: React.FC<{ entity: Entity, type: 'Ally' | 'Enemy' | 'Asset' }> = ({ entity, type }) => {
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

const ArcTracker: React.FC<{ arcs: PlotArc[] }> = ({ arcs }) => {
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

const LedgerPanel = ({ ledger }: { ledger: WorldLedger }) => (
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

const AdvisorCard: React.FC<{ advisor: Advisor; context: string }> = ({ advisor, context }) => {
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
         <div className="flex-grow">
            <div className="flex justify-between items-start">
              <div>
                <h4 className={`text-sm font-bold ${colorClass} uppercase tracking-wider`}>{advisor.role}</h4>
                <p className="text-xs text-gray-500 mb-2">{advisor.name}</p>
              </div>
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded transition-colors ${isExpanded ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700'}`}
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

const NewsTicker = ({ news }: { news: NewsFlash[] }) => (
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

const DeclassifiedReport = ({ analysis }: { analysis: ExecutionAnalysis }) => {
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
        <div className="mt-2 bg-black border border-gray-800 p-4 rounded font-mono text-xs shadow-inner animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                <Activity size={48} className="text-emerald-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 relative z-10">
                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Directive Class</span>
                    <span className={`font-bold ${analysis.directiveType === 'CUSTOM' ? 'text-blue-400 animate-pulse' : 'text-gray-300'}`}>
                        {analysis.directiveType} PROTOCOL
                    </span>
                </div>
                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Calculated Outcome</span>
                    <span className={`font-bold ${outcomeColor} uppercase`}>{analysis.outcomeLabel}</span>
                </div>
                
                <div className="col-span-2 h-px bg-gray-900"></div>

                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Assessed Risk</span>
                    <span className={`font-bold uppercase ${analysis.perceivedRisk === 'EXTREME' || analysis.perceivedRisk === 'HIGH' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {analysis.perceivedRisk}
                    </span>
                </div>
                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Target Threshold</span>
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
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Intel Variance</span>
                    {modifier === 0 ? (
                        <span className="text-gray-500">None</span>
                    ) : (
                        <span className={`font-bold ${modifier > 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {modifier > 0 ? `+${modifier} (Harder)` : `${modifier} (Easier)`}
                        </span>
                    )}
                </div>

                <div>
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Resolution Roll</span>
                    <span className="font-bold text-white flex items-center gap-2">
                        <Dices size={14} className="text-emerald-500" /> {analysis.rollValue}
                    </span>
                </div>
                <div className="col-span-2">
                    <span className="text-gray-600 uppercase tracking-wider block mb-1">Resource Consumption</span>
                    <span className="font-bold text-gray-400">{analysis.resourcesConsumed}</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN INTERFACE ---

interface GameInterfaceProps {
  initialTurn: TurnData;
  onRestart: () => void;
}

export const GameInterface: React.FC<GameInterfaceProps> = ({ initialTurn, onRestart }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([{
    turnNumber: 1,
    year: initialTurn.year,
    narrative: initialTurn.narrative,
    eventTitle: initialTurn.eventTitle,
    statsSnapshot: initialTurn.stats,
    statsDelta: initialTurn.statsDelta,
    statsReasoning: initialTurn.statsReasoning,
    ledgerSnapshot: initialTurn.ledger,
    manifestSnapshot: initialTurn.manifest,
    arcsSnapshot: initialTurn.arcs,
    executionAnalysis: initialTurn.executionAnalysis,
    goalSnapshot: initialTurn.currentGoal,
    goalResultSnapshot: initialTurn.goalResult,
    advisorsSnapshot: initialTurn.advisors // NEW: Initialize with starting advisors
  }]);
  
  const [currentTurnData, setCurrentTurnData] = useState<TurnData>(initialTurn);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("Consulting Intelligence..."); // NEW: For dynamic loading text
  const [customInput, setCustomInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [expandedChoiceId, setExpandedChoiceId] = useState<string | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);

  const lastTurnRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Trigger Debrief Modal when a result is received
  useEffect(() => {
    // Only show debrief if we have a valid result that isn't a placeholder
    const result = currentTurnData.goalResult;
    const isValid = result && result.title !== 'N/A' && result.description !== 'N/A';
    
    if (isValid) {
        setShowDebrief(true);
    }
  }, [currentTurnData]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [customInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading && lastTurnRef.current) {
        lastTurnRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [history.length, loading]);

  const handleTurn = async (choiceText: string, details: string | null = null, choiceMetadata: { risk: string; type: string; confidence: string } | null = null, isCustom: boolean = false) => {
    if (loading || currentTurnData.gameOver) return;

    setLoading(true);
    setLoadingStatus("Simulating Outcome...");
    setError(null);
    setExpandedChoiceId(null);

    let finalRisk = choiceMetadata?.risk || 'HIGH';
    let finalConfidence = choiceMetadata?.confidence || 'MEDIUM';
    let finalType = choiceMetadata?.type || 'CUSTOM';
    let finalDetails = details;

    if (isCustom) {
        finalDetails = `Player submitted custom directive without prior intelligence estimate.`;
    }

    const updatedHistory = [...history];
    updatedHistory[updatedHistory.length - 1].userChoice = choiceText;
    setHistory(updatedHistory);

    try {
      const nextTurnData = await processTurn(updatedHistory, choiceText, finalDetails, { risk: finalRisk, type: finalType, confidence: finalConfidence }, isCustom ? choiceText : undefined);
      
      const newEntry: HistoryEntry = {
        turnNumber: updatedHistory.length + 1,
        year: nextTurnData.year,
        narrative: nextTurnData.narrative,
        eventTitle: nextTurnData.eventTitle,
        statsSnapshot: nextTurnData.stats,
        statsDelta: nextTurnData.statsDelta,
        statsReasoning: nextTurnData.statsReasoning,
        ledgerSnapshot: nextTurnData.ledger,
        manifestSnapshot: nextTurnData.manifest,
        arcsSnapshot: nextTurnData.arcs,
        executionAnalysis: nextTurnData.executionAnalysis,
        goalSnapshot: nextTurnData.currentGoal,
        goalResultSnapshot: nextTurnData.goalResult,
        advisorsSnapshot: nextTurnData.advisors // NEW: Persist advisors
      };

      setHistory(prev => [...prev, newEntry]);
      setCurrentTurnData(nextTurnData);
      setCustomInput('');
    } catch (err: any) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`CRITICAL ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const renderDelta = (val: number, label: string) => {
    if (val > 0) return <span className="text-emerald-400 flex items-center gap-1 font-mono font-bold" title={label}><TrendingUp size={14} /> +{val}</span>;
    if (val < 0) return <span className="text-red-400 flex items-center gap-1 font-mono font-bold" title={label}><TrendingDown size={14} /> {val}</span>;
    return <span className="text-gray-600 flex items-center gap-1 font-mono font-bold" title={label}><Minus size={14} /> -</span>;
  };

  const renderChoiceButton = (choice: Choice) => {
    const isExpanded = expandedChoiceId === choice.id;
    let borderColor = 'border-gray-700 hover:border-gray-500';
    let typeColor = 'text-gray-500';
    let glowClass = "";

    if (choice.type === 'force') {
      borderColor = 'border-red-900/40 hover:border-red-500/80';
      typeColor = 'text-red-500';
      glowClass = "from-red-900/20 to-transparent";
    } else if (choice.type === 'diplomacy') {
      borderColor = 'border-blue-900/40 hover:border-blue-500/80';
      typeColor = 'text-blue-500';
      glowClass = "from-blue-900/20 to-transparent";
    } else if (choice.type === 'profit') {
      borderColor = 'border-yellow-900/40 hover:border-yellow-500/80';
      typeColor = 'text-yellow-500';
      glowClass = "from-yellow-900/20 to-transparent";
    } else if (choice.type === 'innovation') {
      borderColor = 'border-purple-900/40 hover:border-purple-500/80';
      typeColor = 'text-purple-500';
      glowClass = "from-purple-900/20 to-transparent";
    }

    if (isExpanded) {
        borderColor = 'border-emerald-500/50 ring-1 ring-emerald-500/30';
    }

    const riskConfig = getRiskConfig(choice.risk);
    const ranges = getOutcomeRanges(choice.risk);

    const getRiskColor = (r: string) => {
      switch(r) {
        case 'LOW': return 'bg-emerald-900/50 text-emerald-400';
        case 'MEDIUM': return 'bg-yellow-900/50 text-yellow-400';
        case 'HIGH': return 'bg-orange-900/50 text-orange-400';
        case 'EXTREME': return 'bg-red-900/50 text-red-400';
        default: return 'bg-gray-800 text-gray-400';
      }
    }
    
    const getConfidenceColor = (c: string) => {
      switch(c) {
        case 'HIGH': return 'text-emerald-400 border-emerald-900/50';
        case 'MEDIUM': return 'text-yellow-400 border-yellow-900/50';
        case 'LOW': return 'text-orange-500 border-orange-900/50';
        case 'VOLATILE': return 'text-red-500 border-red-900/50 animate-pulse';
        default: return 'text-gray-400 border-gray-700';
      }
    }

    return (
      <div
        key={choice.id}
        onClick={() => !isExpanded && setExpandedChoiceId(choice.id)}
        className={`w-full text-left rounded-lg border ${borderColor} bg-gray-900/80 transition-all duration-200 group relative overflow-hidden shadow-lg flex flex-col ${isExpanded ? 'scale-[1.01] z-10' : 'hover:scale-[1.01] cursor-pointer'}`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${glowClass} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
        <div className="p-5 relative z-10">
            <div className="flex justify-between items-start w-full mb-3">
                <span className={`text-xs uppercase tracking-widest font-mono ${typeColor}`}>{choice.type}</span>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${getRiskColor(choice.risk)}`}>
                        EST. RISK: {choice.risk}
                    </span>
                </div>
            </div>
            <span className="text-gray-200 group-hover:text-white font-medium leading-snug text-lg block mb-2">{choice.text}</span>
            {choice.projectedCost && !isExpanded && (
                <div className="mt-1">
                    <span className="text-xs text-gray-500 italic flex items-center gap-1">
                    <AlertTriangle size={10} /> {choice.projectedCost}
                    </span>
                </div>
            )}
            {choice.detailedDescription && (
                <div className="mt-4 p-3 bg-black/30 rounded border-l-2 border-gray-700">
                    <h5 className="text-[10px] font-mono text-emerald-500 uppercase mb-1 flex items-center gap-1">
                        <Target size={10} /> Strategic Analysis
                    </h5>
                    <p className="text-xs text-gray-400 leading-relaxed">{choice.detailedDescription}</p>
                </div>
            )}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-700/50 animate-fade-in space-y-4">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`bg-black/30 p-3 rounded border ${getConfidenceColor(choice.forecastConfidence || 'MEDIUM')}`}>
                            <h5 className="text-[10px] font-mono uppercase mb-1 flex items-center gap-1 opacity-80">
                                {choice.forecastConfidence === 'HIGH' ? <Eye size={10}/> : <EyeOff size={10}/>} 
                                Consensus Intel Estimate
                            </h5>
                            <p className="text-sm font-mono font-bold tracking-widest">EST. {choice.risk} RISK (CONFIDENCE: {choice.forecastConfidence || 'MEDIUM'})</p>
                        </div>
                        {choice.projectedCost && (
                            <div className="bg-yellow-900/10 p-3 rounded border border-yellow-900/30">
                                <h5 className="text-[10px] font-mono text-yellow-500 uppercase mb-1 flex items-center gap-1"><AlertTriangle size={10} /> Advisor Est. Cost</h5>
                                <p className="text-sm text-gray-300 font-mono">{choice.projectedCost}</p>
                            </div>
                        )}
                    </div>
                    {choice.technicalReport && (
                        <div>
                            <h5 className="text-[10px] font-mono text-blue-400 uppercase mb-2 flex items-center gap-1"><FileText size={10} /> Advisor Briefing</h5>
                            <div className="text-xs text-gray-400 leading-relaxed space-y-2 border-l border-blue-900/50 pl-3">
                                {choice.technicalReport.split('\n\n').map((para, i) => (
                                    <p key={i}>{para}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setExpandedChoiceId(null); }}
                            className="flex-1 py-3 text-xs font-bold text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button 
                             onClick={(e) => { e.stopPropagation(); handleTurn(choice.text, choice.technicalReport, { risk: choice.risk, type: choice.type, confidence: choice.forecastConfidence }); }}
                             className="flex-[2] py-3 text-xs font-bold text-black bg-emerald-500 hover:bg-emerald-400 rounded transition-colors flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg shadow-emerald-900/20"
                        >
                            <CheckCircle size={14} /> Execute Protocol
                        </button>
                    </div>
                </div>
            )}
        </div>
        {!isExpanded && (
            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-50 transition-opacity">
                <ChevronDown size={16} className="text-gray-500" />
            </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 font-serif">
      <StatBar stats={currentTurnData.stats} year={currentTurnData.year} manifest={currentTurnData.manifest} onToggleLedger={() => setShowLedger(true)} />
      
      {/* Ledger Modal */}
      {showLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950">
              <h3 className="text-lg font-mono font-bold text-emerald-500 flex items-center gap-2">
                <Globe size={18} /> STRATEGIC INTELLIGENCE LEDGER
              </h3>
              <button onClick={() => setShowLedger(false)} className="text-gray-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div>
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <HeartHandshake size={14}/> Allies & Factions
                      </h4>
                      <div className="space-y-3">
                          {currentTurnData.ledger.allies.map(e => <EntityCard key={e.id} entity={e} type="Ally" />)}
                      </div>
                  </div>
                  <div>
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Briefcase size={14}/> Key Assets
                      </h4>
                      <div className="space-y-3">
                          {currentTurnData.ledger.assets.map(e => <EntityCard key={e.id} entity={e} type="Asset" />)}
                      </div>
                  </div>
                  <div>
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <ShieldAlert size={14}/> Hostiles & Threats
                      </h4>
                      <div className="space-y-3">
                          {currentTurnData.ledger.enemies.map(e => <EntityCard key={e.id} entity={e} type="Enemy" />)}
                      </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-grow overflow-y-auto scroll-smooth">
        <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24 space-y-12">
          {history.map((entry, index) => {
            const isCurrent = index === history.length - 1;
            const labels = entry.manifestSnapshot.statsConfig;
            
            return (
              <div 
                key={index} 
                ref={isCurrent ? lastTurnRef : null}
                className={`animate-fade-in ${isCurrent ? 'opacity-100' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500'}`}
              >
                <div className="flex items-center gap-4 mb-6 opacity-40">
                  <div className="h-px bg-gray-700 flex-grow"></div>
                  <span className="text-xs font-mono uppercase tracking-widest text-emerald-500">
                    {index === 0 ? 'Divergence Point' : `Turn ${entry.turnNumber}`}
                  </span>
                  <div className="h-px bg-gray-700 flex-grow"></div>
                </div>
                <div className="space-y-6">
                  <h2 className="text-3xl text-emerald-100 font-bold font-serif text-center mb-8">{entry.eventTitle}</h2>
                  {isCurrent ? (
                    <>
                       <GoalTracker goal={currentTurnData.currentGoal} timeUnit={currentTurnData.manifest.timeUnit} />
                       <NewsTicker news={currentTurnData.news} />
                       <ArcTracker arcs={currentTurnData.arcs} />
                       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 bg-gray-900 border border-gray-700 rounded-lg p-6 shadow-lg relative flex flex-col gap-4">
                             <div className="absolute -top-3 left-4 bg-gray-950 px-2 text-xs font-mono text-red-500 border border-red-900 rounded flex items-center gap-1">
                                <Lock size={10} /> TOP SECRET // EYES ONLY
                             </div>
                             <div className="prose prose-invert prose-lg max-w-none text-gray-300 leading-loose">
                                <p className="whitespace-pre-wrap font-serif text-justify">{currentTurnData.narrative}</p>
                             </div>
                             <div className="mt-8 pt-6 border-t border-gray-800">
                                <h4 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-3">Impact Assessment</h4>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                                    <div className="flex gap-4 text-xs">
                                        <div className="flex flex-col items-center">
                                            {renderDelta(entry.statsDelta.stability, labels.stabilityLabel)}
                                            <span className="text-[10px] text-gray-600 uppercase mt-1">{labels.stabilityLabel}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            {renderDelta(entry.statsDelta.wealth, labels.wealthLabel)}
                                            <span className="text-[10px] text-gray-600 uppercase mt-1">{labels.wealthLabel}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            {renderDelta(entry.statsDelta.support, labels.supportLabel)}
                                            <span className="text-[10px] text-gray-600 uppercase mt-1">{labels.supportLabel}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            {renderDelta(entry.statsDelta.primaryStatValue, labels.primaryStatLabel)}
                                            <span className="text-[10px] text-gray-600 uppercase mt-1">{labels.primaryStatLabel}</span>
                                        </div>
                                    </div>
                                    <div className="flex-grow pl-0 sm:pl-6 sm:border-l border-gray-800">
                                        <p className="text-sm text-gray-400 italic font-mono leading-relaxed">
                                            "{entry.statsReasoning || "Impact minimal."}"
                                        </p>
                                    </div>
                                </div>
                                {entry.executionAnalysis && <DeclassifiedReport analysis={entry.executionAnalysis} />}
                             </div>
                          </div>
                          <div className="space-y-4">
                             <h3 className="text-xs font-mono uppercase text-gray-500 flex items-center gap-2"><MessageSquare size={12}/> Advisory Council</h3>
                             {currentTurnData.advisors.map((adv) => (
                               <AdvisorCard key={adv.id} advisor={adv} context={currentTurnData.narrative} />
                             ))}
                          </div>
                       </div>
                    </>
                  ) : (
                    <div className="prose prose-invert prose-lg max-w-none text-gray-400">
                         {/* Historical Goal Snapshot if interesting, or just simplified view */}
                        <div className="bg-black/40 p-2 mb-4 border border-gray-800 rounded flex justify-between items-center text-xs font-mono text-gray-500">
                            <span>Objective: {entry.goalSnapshot.description}</span>
                            <span className={entry.goalSnapshot.turnsRemaining < 3 ? "text-red-500" : "text-gray-400"}>
                                T-{entry.goalSnapshot.turnsRemaining}
                            </span>
                        </div>

                        <p className="whitespace-pre-wrap">{entry.narrative}</p>
                        {entry.userChoice && (
                          <div className="bg-gray-900/50 border-l-2 border-emerald-700 pl-4 py-2 mt-4 rounded-r">
                            <p className="text-xs font-mono text-emerald-600 mb-1 uppercase tracking-wider">Historical Decision</p>
                            <p className="text-sm text-gray-300 italic">"{entry.userChoice}"</p>
                          </div>
                        )}
                        {entry.executionAnalysis && <DeclassifiedReport analysis={entry.executionAnalysis} />}
                        {entry.goalResultSnapshot && (
                           <div className={`mt-4 p-4 rounded border ${entry.goalResultSnapshot.outcome === 'VICTORY' ? 'bg-emerald-900/20 border-emerald-800' : 'bg-red-900/20 border-red-800'}`}>
                               <h4 className={`text-sm font-bold uppercase tracking-wide mb-1 ${entry.goalResultSnapshot.outcome === 'VICTORY' ? 'text-emerald-400' : 'text-red-400'}`}>
                                   MISSION REPORT: {entry.goalResultSnapshot.outcome}
                               </h4>
                               <p className="text-xs text-gray-400 italic">{entry.goalResultSnapshot.description}</p>
                           </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 animate-pulse gap-4 text-emerald-500/70">
              <RefreshCw className="animate-spin w-8 h-8" />
              <span className="font-mono text-sm uppercase tracking-widest">{loadingStatus}</span>
            </div>
          )}
          {error && (
              <div className="bg-red-900/20 border border-red-800 text-red-300 p-6 rounded-lg flex items-start gap-4 animate-fade-in break-words">
                  <AlertTriangle className="flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-bold mb-1">Simulation Error</p>
                    <p className="text-sm break-words">{error}</p>
                    <button onClick={() => setError(null)} className="mt-2 text-xs underline hover:text-white">Dismiss</button>
                  </div>
              </div>
          )}
          {!currentTurnData.gameOver && !loading && (
             <div className="mt-12 pt-8 animate-fade-in border-t border-gray-800">
                 <div className="flex justify-between items-end mb-6">
                    <div className="flex items-center gap-3">
                        <Terminal size={18} className="text-emerald-500" />
                        <h3 className="text-sm font-mono text-emerald-500 uppercase tracking-widest">Command Center</h3>
                    </div>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {currentTurnData.choices.map(renderChoiceButton)}
                 </div>
                 <div className="space-y-4">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-900 to-blue-900 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                        <div className="relative flex items-end bg-gray-950 rounded-lg border border-gray-700 shadow-inner">
                            <textarea
                                ref={textareaRef}
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                placeholder="Overwrite protocol with custom directive..."
                                rows={1}
                                className="w-full bg-transparent border-none rounded-lg pl-5 pr-32 py-4 focus:ring-0 text-base font-mono resize-none overflow-hidden"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        if(customInput) handleTurn(customInput, null, null, true);
                                    }
                                }}
                            />
                            <button 
                                onClick={() => handleTurn(customInput, null, null, true)}
                                disabled={!customInput.trim() || loading}
                                className="absolute right-3 bottom-3 px-3 py-2 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-800 hover:text-emerald-100 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs font-mono uppercase tracking-widest flex items-center gap-2"
                            >
                                <Send size={14} /> Execute
                            </button>
                        </div>
                    </div>
                 </div>
             </div>
          )}
          {currentTurnData.gameOver && !loading && (
             <div className="bg-gray-800 border border-yellow-700/50 p-8 rounded-xl text-center shadow-2xl mt-12">
                <h3 className="text-3xl font-bold text-yellow-500 mb-4">Timeline Terminated</h3>
                <p className="text-gray-300 mb-8">The simulation has reached a conclusion.</p>
                <button 
                  onClick={onRestart}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-lg font-bold shadow-lg transition-transform hover:scale-105 uppercase tracking-wide text-sm"
                >
                  Initialize New Divergence
                </button>
             </div>
          )}
          <div className="h-4" />
        </div>
      </div>

      {showDebrief && currentTurnData.goalResult && (
        <MissionDebriefModal 
            result={currentTurnData.goalResult} 
            nextGoal={currentTurnData.currentGoal} 
            onContinue={() => setShowDebrief(false)}
            onTerminate={onRestart}
        />
      )}
    </div>
  );
};