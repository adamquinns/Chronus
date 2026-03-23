import React from 'react';
import { GameStats, SimulationManifest } from '../types';
import { Scale, Coins, Users, Zap, Globe } from 'lucide-react';

interface StatBarProps {
  stats: GameStats;
  year: string;
  manifest: SimulationManifest;
  onToggleLedger?: () => void;
}

export const StatBar: React.FC<StatBarProps> = ({ stats, year, manifest, onToggleLedger }) => {
  const getColor = (val: number) => {
    if (val < 30) return 'text-red-500';
    if (val > 70) return 'text-emerald-500';
    return 'text-yellow-500';
  };

  const formatPop = (val: number) => {
    if (val > 100) {
      return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(val);
    }
    return `${val}%`;
  };

  const labels = manifest.statsConfig;

  return (
    <div className="sticky top-0 z-30 w-full bg-gray-900 border-b border-gray-700 shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xl font-bold text-white tracking-widest">{year}</span>
        <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-gray-800 text-[10px] text-gray-500 uppercase font-mono border border-gray-700">
            {manifest.timeUnit}
        </span>
      </div>

      <div className="flex gap-6 text-sm sm:text-base font-mono">
        {/* Stability / Primary Health */}
        <div className={`flex items-center gap-2 ${getColor(stats.stability)}`} title={labels.stabilityLabel}>
          <Scale size={18} />
          <span className="hidden sm:inline text-xs uppercase text-gray-500 mr-1">{labels.stabilityLabel}:</span>
          <span className="font-bold">{stats.stability}%</span>
        </div>

        {/* Wealth / Resources */}
        <div className={`flex items-center gap-2 ${getColor(stats.wealth)}`} title={labels.wealthLabel}>
          <Coins size={18} />
          <span className="hidden sm:inline text-xs uppercase text-gray-500 mr-1">{labels.wealthLabel}:</span>
          <span className="font-bold">{stats.wealth}%</span>
        </div>

        {/* Support / Population */}
        <div className={`flex items-center gap-2 ${getColor(stats.support)}`} title={labels.supportLabel}>
          <Users size={18} />
          <span className="hidden sm:inline text-xs uppercase text-gray-500 mr-1">{labels.supportLabel}:</span>
          <span className="font-bold">{formatPop(stats.support)}</span>
        </div>

        {/* Dynamic Context Stat */}
        <div className={`flex items-center gap-2 ${getColor(stats.primaryStatValue)}`} title={labels.primaryStatLabel}>
          <Zap size={18} />
          <span className="font-bold hidden sm:inline text-xs uppercase text-gray-400 mr-1">{labels.primaryStatLabel}:</span>
          <span className="font-bold">{stats.primaryStatValue}%</span>
        </div>
      </div>

      {onToggleLedger && (
        <button 
          onClick={onToggleLedger}
          className="ml-auto bg-gray-800 hover:bg-gray-700 text-emerald-400 border border-gray-600 px-3 py-1.5 rounded flex items-center gap-2 text-xs font-mono uppercase tracking-widest transition-colors"
        >
          <Globe size={14} />
          <span className="hidden sm:inline">Intel Ledger</span>
        </button>
      )}
    </div>
  );
};
