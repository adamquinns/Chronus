
import React, { useState } from 'react';
import { GameStatus, TurnData } from './types';
import { initializeGame } from './services/geminiService';
import { ScenarioSelector } from './components/ScenarioSelector';
import { GameInterface } from './components/GameInterface';
import { RefreshCw, Zap, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [initialTurnData, setInitialTurnData] = useState<TurnData | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const handleStartGame = async (context: string) => {
    setStatus(GameStatus.LOADING);
    setLoadingError(null);
    try {
      const data = await initializeGame(context);
      setInitialTurnData(data);
      setStatus(GameStatus.PLAYING);
    } catch (error: any) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Unknown error occurred";
      setLoadingError(`CRITICAL FAILURE: ${msg}`);
      setStatus(GameStatus.MENU);
    }
  };

  const handleRestart = () => {
    setStatus(GameStatus.MENU);
    setInitialTurnData(null);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {status === GameStatus.MENU && (
        <div className="flex-grow flex flex-col items-center justify-center p-4">
           {loadingError && (
             <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200 max-w-2xl w-full text-center flex flex-col items-center gap-2 animate-fade-in shadow-xl break-words">
               <AlertTriangle className="text-red-500 w-8 h-8" />
               <span className="font-mono text-sm">{loadingError}</span>
               <p className="text-xs text-red-400 mt-2">Check your API key quota or connection and try again.</p>
             </div>
           )}
           <ScenarioSelector onSelect={handleStartGame} />
        </div>
      )}

      {status === GameStatus.LOADING && (
        <div className="flex-grow flex flex-col items-center justify-center p-4 space-y-6 animate-pulse">
           <Zap size={64} className="text-emerald-400" />
           <h2 className="text-3xl font-mono font-bold text-emerald-500 tracking-widest">BUILDING WORLD STATE</h2>
           <p className="text-gray-500 font-mono">Calculating historical trajectories...</p>
           <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
             <div className="h-full bg-emerald-500 animate-[width_2s_ease-in-out_infinite]" style={{ width: '50%' }}></div>
           </div>
        </div>
      )}

      {status === GameStatus.PLAYING && initialTurnData && (
        <GameInterface initialTurn={initialTurnData} onRestart={handleRestart} />
      )}
    </div>
  );
};

export default App;
