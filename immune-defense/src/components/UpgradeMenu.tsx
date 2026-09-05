import React from 'react';
import { GameEngine } from '../game/GameEngine';
import { ArrowUpCircle, Zap, Shield, Crosshair } from 'lucide-react';
import { soundManager } from '../game/audio';

interface Props {
  engine: GameEngine;
  atp: number;
  wave: number;
  onUpgrade: () => void;
  onStartWave: () => void;
}

/**
 * ウェーブとウェーブの間の研究。
 *
 * 以前はここに3つ並んでいた強化のうち2つが実際には効いていなかった。
 *  - 攻撃力強化: 細胞に直接掛けていたため、次に1体でも配置すると
 *    updateBuffs() に上書きされて消えていた → エンジン側の全体倍率へ移した
 *  - ATP生産強化: 100払って50もらうだけの純損だった → ウェーブクリア時の
 *    回収量を実際に増やすようにした
 * 値段が固定で無限に買えたので、買うたびに5割ずつ上がるようにしてある。
 */
export const UpgradeMenu: React.FC<Props> = ({ engine, atp, wave, onUpgrade, onStartWave }) => {
  const upgradeOptions = [
    {
      id: 'damage',
      name: '攻撃力強化',
      description: '全細胞の攻撃力 +20%（重ねがけ可）',
      base: 150,
      icon: <Zap size={22} className="text-amber-400" />,
      action: () => { engine.globalDamageMultiplier *= 1.2; }
    },
    {
      id: 'atp',
      name: 'ATP生産強化',
      description: 'ウェーブクリア時のATP回収 +25',
      base: 100,
      icon: <Shield size={22} className="text-emerald-400" />,
      action: () => { engine.atpBonus += 25; }
    },
    {
      id: 'range',
      name: '射程延長',
      description: '全細胞の射程 +15%',
      base: 120,
      icon: <Crosshair size={22} className="text-cyan-400" />,
      action: () => { engine.globalRangeMultiplier *= 1.15; }
    }
  ];

  return (
    <div className="w-full bg-slate-900/95 backdrop-blur-xl p-4 md:p-5 rounded-2xl border border-slate-600 shadow-2xl flex flex-col gap-3">
      {wave === 0 ? (
        <>
          <h3 className="text-lg font-bold text-slate-100 text-center">準備フェーズ</h3>
          <p className="text-sm text-slate-300 text-center">
            細胞を配置して防衛の準備をしてください。準備ができたらウェーブを開始します。
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ArrowUpCircle className="text-indigo-400" />
            研究・強化 (Upgrades)
          </h3>
          <p className="text-xs text-slate-400">
            ATPを使って全体を強化できます。強化せずに次へ進むこともできます。
          </p>

          <div className="grid gap-2 md:grid-cols-3">
            {upgradeOptions.map(opt => {
              const level = engine.upgradeCounts[opt.id] || 0;
              const cost = engine.upgradeCost(opt.id, opt.base);
              const afford = atp >= cost;
              return (
                <button
                  key={opt.id}
                  disabled={!afford}
                  onClick={() => {
                    if (engine.buyUpgrade(opt.id, opt.base, opt.action)) {
                      soundManager.build();
                      onUpgrade();
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    afford
                      ? 'bg-slate-800 border-slate-600 hover:border-indigo-400 hover:bg-slate-700'
                      : 'bg-slate-900 border-slate-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="p-2 bg-slate-900 rounded-lg shadow-inner shrink-0">{opt.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      {opt.name}
                      {level > 0 && <span className="text-[10px] font-mono text-indigo-300">Lv{level}</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">{opt.description}</div>
                  </div>
                  <div className="font-mono text-emerald-400 font-bold text-sm shrink-0">{cost}</div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={onStartWave}
        className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex justify-center items-center gap-2"
      >
        {wave === 0 ? 'ゲームを開始' : `Wave ${wave + 1} を開始`}
      </button>
    </div>
  );
};
