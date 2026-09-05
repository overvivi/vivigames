import React from 'react';
import { CELL_DEFINITIONS, CellType, GameState } from '../game/constants';
import { Shield, Plus, Zap, Heart, Disc, Activity, Lock, Droplets, Radio } from 'lucide-react';

interface Props {
  selectedCellType: CellType | null;
  onSelect: (type: CellType | null) => void;
  atp: number;
  wave: number;
}

export const BuildMenu: React.FC<Props> = ({ selectedCellType, onSelect, atp, wave }) => {
  const getIcon = (type: CellType) => {
    switch (type) {
      case 'Neutrophil': return <Shield size={20} />;
      case 'Macrophage': return <Disc size={20} />;
      case 'NKCell': return <Zap size={20} />;
      case 'HelperTCell': return <Plus size={20} />;
      case 'MemoryBCell': return <Activity size={20} />;
      case 'Eosinophil': return <Droplets size={20} />;
      case 'PlasmaCell': return <Radio size={20} />;
      default: return <Heart size={20} />;
    }
  };

  const isUnlocked = (type: CellType) => {
    switch(type) {
      case 'NKCell': return wave >= 3;
      case 'HelperTCell': return wave >= 5;
      case 'Eosinophil': return wave >= 7;
      case 'MemoryBCell': return wave >= 9;
      case 'PlasmaCell': return wave >= 11;
      default: return true;
    }
  };

  const getUnlockWave = (type: CellType) => {
    switch(type) {
      case 'NKCell': return 3;
      case 'HelperTCell': return 5;
      case 'Eosinophil': return 7;
      case 'MemoryBCell': return 9;
      case 'PlasmaCell': return 11;
      default: return 0;
    }
  }

  return (
    <div className="flex xl:flex-col gap-2 xl:gap-3 w-full xl:w-72 h-auto xl:h-[560px] overflow-x-auto xl:overflow-y-auto bg-slate-800 p-2 xl:p-4 rounded-lg shadow-xl border border-slate-700 snap-x">
      <h2 className="hidden xl:flex text-xl font-bold text-slate-100 items-center gap-2 mb-2 border-b border-slate-700 pb-2 shrink-0">
        <Activity className="text-emerald-400" />
        細胞配置 (Units)
      </h2>
      <p className="hidden xl:block text-xs text-slate-400 mb-2 shrink-0">マスをクリックして配置</p>
      
      {(Object.keys(CELL_DEFINITIONS) as CellType[]).map((key) => {
        const def = CELL_DEFINITIONS[key];
        const unlocked = isUnlocked(key);
        const canAfford = atp >= def.cost;
        const isSelected = selectedCellType === key;
        
        return (
          <button
            key={key}
            disabled={(!canAfford && !isSelected) || !unlocked}
            onClick={() => onSelect(isSelected ? null : key)}
            className={`relative flex flex-col text-left p-2 xl:p-3 rounded-md transition-all duration-200 border-2 shrink-0 w-[124px] xl:w-auto snap-center ${
              !unlocked ? 'border-slate-800 bg-slate-900 opacity-60 cursor-not-allowed' :
              isSelected 
                ? 'border-emerald-400 bg-emerald-900/30' 
                : canAfford 
                  ? 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 hover:border-slate-500' 
                  : 'border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed'
            }`}
          >
            {!unlocked && (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-[2px] rounded-sm z-10">
                  <Lock className="text-slate-400 mb-1" size={18} />
                  <span className="text-[10px] xl:text-xs font-bold text-slate-300 text-center leading-tight">Wave {getUnlockWave(key)}<br className="xl:hidden" /> で解放</span>
               </div>
            )}
            <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center w-full mb-1 gap-0.5">
              <span className="font-semibold text-xs xl:text-sm text-slate-100 flex items-center gap-1.5">
                <span style={{ color: def.color }}>{getIcon(key)}</span>
                <span className="xl:hidden">{def.name.split(' (')[0]}</span>
                <span className="hidden xl:inline">{def.name}</span>
              </span>
              <span className="font-mono text-emerald-400 text-xs xl:text-sm font-bold">{def.cost} ATP</span>
            </div>
            <p className="hidden xl:block text-xs text-slate-300 leading-tight mb-2">
              {def.description}
            </p>
            <div className="hidden xl:flex gap-2 text-[10px] text-slate-400 font-mono mt-auto">
              {def.damage > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded">ATK: {def.damage}</span>}
              <span className="bg-slate-900 px-1.5 py-0.5 rounded">RNG: {def.range}</span>
              {def.fireRate > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded">SPD: {def.fireRate}/s</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
};
