import React from 'react';
import { Shield, Zap, Skull, Activity, FastForward } from 'lucide-react';

interface Props {
  atp: number;
  hp: number;
  wave: number;
  gameSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export const HUD: React.FC<Props> = ({ atp, hp, wave, gameSpeed, onSpeedChange }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center w-full bg-slate-800/90 backdrop-blur p-4 rounded-lg shadow-xl border border-slate-700 mb-4 gap-4 md:gap-0">
      <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-8">
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Health</span>
          <div className="flex items-center gap-2 text-xl md:text-2xl font-bold text-rose-400">
            <HeartPulse />
            {hp}
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Energy (ATP)</span>
          <div className="flex items-center gap-2 text-xl md:text-2xl font-bold text-emerald-400">
            <Zap className="fill-emerald-400" />
            {atp}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-8">
        <div className="flex items-center gap-1 md:gap-2 bg-slate-900/50 p-1 md:p-1.5 rounded-lg border border-slate-700">
          <FastForward size={16} className="text-slate-400 mx-1 hidden sm:block" />
          {[1, 1.5, 2].map(speed => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={`px-2 md:px-3 py-1 text-xs md:text-sm font-bold rounded-md transition-all ${
                gameSpeed === speed 
                  ? 'bg-emerald-500 text-slate-900 shadow-md' 
                  : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Current Wave</span>
          <div className="flex items-center gap-2 text-xl md:text-2xl font-bold text-amber-400">
            <Skull className="text-amber-400" />
            {wave}
          </div>
        </div>
      </div>
    </div>
  );
};

const HeartPulse = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
)

