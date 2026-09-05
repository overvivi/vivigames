import React, { useEffect, useState, useRef } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameState, CellType, CELL_DEFINITIONS, VICTORY_WAVE } from './game/constants';
import { Cell } from './game/entities/Cell';
import { GameCanvas } from './components/GameCanvas';
import { BuildMenu } from './components/BuildMenu';
import { HUD } from './components/HUD';
import { Play, RotateCcw, Trash2, Trophy, Volume2, VolumeX, ChevronLeft } from 'lucide-react';
import { BG_URL } from './bg';
import { soundManager } from './game/audio';

import { UpgradeMenu } from './components/UpgradeMenu';

export default function App() {
  const engineRef = useRef(new GameEngine());
  const [engine] = useState(engineRef.current);

  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [stats, setStats] = useState({ atp: 200, hp: 20, wave: 0, gameSpeed: 1.0 });
  const [selectedCellType, setSelectedCellType] = useState<CellType | null>(null);
  // 盤面で選んでいる既設の細胞。射程の確認と売却に使う
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [muted, setMuted] = useState(soundManager.muted);
  const [, setForceRender] = useState(0);

  useEffect(() => {
    engine.onStateChange = setGameState;
    engine.onStatsChange = (s) => {
      setStats(s);
    };

    return () => {
      engine.stop();
    };
  }, [engine]);

  const startGame = () => {
    soundManager.init();
    setSelectedCell(null);
    setSelectedCellType(null);
    engine.start();
  };

  const handleCellBuilt = () => {
    setSelectedCellType(null);
  };

  const handleUpgrade = () => {
    engine.updateStats(); // Force stat refresh
    setForceRender(prev => prev + 1);
  };

  const handleStartWave = () => {
    setSelectedCell(null);
    engine.startNextWave();
  };

  const handleSellCell = () => {
    if (!selectedCell) return;
    engine.sellCell(selectedCell);
    setSelectedCell(null);
    setForceRender(prev => prev + 1);
  };

  return (
    <div
      className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans bg-cover bg-center overflow-x-hidden"
      style={{ backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.95)), url(${BG_URL})` }}
    >

      {/* ゲーム置き場へ戻る導線と音の入切。どの画面からでも押せる位置に置く */}
      <div className="fixed top-3 left-3 z-[60] flex gap-2">
        <a
          href="../index.html"
          className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-900/80 border border-slate-600 text-slate-300 hover:text-emerald-300 hover:border-emerald-400 transition-colors text-[11px] tracking-widest"
        >
          <ChevronLeft size={14} />
          BASE
        </a>
        <button
          onClick={() => { const v = !muted; soundManager.setMuted(v); setMuted(v); }}
          className="px-2.5 py-2 rounded-lg bg-slate-900/80 border border-slate-600 text-slate-300 hover:text-emerald-300 hover:border-emerald-400 transition-colors"
          aria-label="音のON/OFF"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      {gameState === GameState.MENU && (
        <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700 text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
            Immune Defense
          </h1>
          <p className="text-slate-400 mb-8">病原菌から体を守る戦略タワーディフェンス</p>

          <button
            onClick={startGame}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2"
          >
            <Play fill="currentColor" />
            ゲームスタート
          </button>
        </div>
      )}

      {gameState === GameState.VICTORY && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-emerald-400/50 text-center max-w-sm w-full">
            <Trophy className="mx-auto mb-3 text-amber-300" size={44} />
            <h2 className="text-3xl font-black text-emerald-400 mb-3">DEFENDED</h2>
            <p className="text-slate-300 mb-6">
              Wave {VICTORY_WAVE} を守り切りました。<br />感染は収束です。
            </p>
            <button
              onClick={startGame}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-3 px-6 rounded-lg transition-all shadow-lg flex justify-center items-center gap-2"
            >
              <RotateCcw />
              もう一度
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-rose-500/50 text-center max-w-sm w-full">
            <h2 className="text-4xl font-black text-rose-500 mb-4">GAME OVER</h2>
            <p className="text-slate-300 mb-6">感染が広がってしまいました。<br/>到達Wave: {stats.wave}</p>
            <button
              onClick={startGame}
              className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg flex justify-center items-center gap-2"
            >
              <RotateCcw />
              リトライ
            </button>
          </div>
        </div>
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.WAVE_TRANSITION) && (
        <div className="flex flex-col items-center animate-in fade-in duration-500 relative w-full max-w-[1600px] mx-auto">
          <HUD
            atp={stats.atp}
            hp={stats.hp}
            wave={stats.wave}
            gameSpeed={stats.gameSpeed}
            onSpeedChange={(speed) => engine.setSpeed(speed)}
          />

          <div className="flex flex-col xl:flex-row gap-4 items-start w-full">
            <div className="relative w-full xl:flex-1 min-w-0 flex flex-col gap-2">
              <GameCanvas
                engine={engine}
                selectedCellType={selectedCellType}
                onCellBuilt={handleCellBuilt}
                selectedCell={selectedCell}
                onSelectCell={setSelectedCell}
              />

              {/* 選択中の細胞。射程は盤面に青い円で出る */}
              {selectedCell && (
                <div className="flex items-center gap-3 bg-slate-800/90 border border-sky-500/40 rounded-lg px-3 py-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CELL_DEFINITIONS[selectedCell.type].color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-100 truncate">{CELL_DEFINITIONS[selectedCell.type].name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ATK {CELL_DEFINITIONS[selectedCell.type].damage} / RNG {Math.round(CELL_DEFINITIONS[selectedCell.type].range * engine.globalRangeMultiplier)}
                      {selectedCell.damageMultiplier > 1 && ' / T細胞の支援 +50%'}
                    </div>
                  </div>
                  <button
                    onClick={handleSellCell}
                    className="flex items-center gap-1 text-xs bg-rose-600/80 hover:bg-rose-600 text-white px-3 py-2 rounded-lg shrink-0"
                  >
                    <Trash2 size={14} />
                    売却 +{Math.floor(CELL_DEFINITIONS[selectedCell.type].cost * 0.6)}
                  </button>
                  <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-slate-200 px-2 shrink-0">×</button>
                </div>
              )}

              {/* 準備・研究のパネルは盤面の下に置く。
                  以前は盤面の中央に重ねていたので、「細胞を配置してください」と
                  言いながら肝心の盤面を隠していた */}
              {gameState === GameState.WAVE_TRANSITION && (
                <UpgradeMenu engine={engine} atp={stats.atp} wave={stats.wave} onUpgrade={handleUpgrade} onStartWave={handleStartWave} />
              )}

              <p className="text-[11px] text-slate-400 text-center xl:hidden bg-slate-800/50 py-1.5 rounded-lg border border-slate-700">
                盤面はスワイプで移動、2本指でズーム。置いた細胞を押すと射程と売却が出ます
              </p>
            </div>

            <BuildMenu
              selectedCellType={selectedCellType}
              onSelect={(t) => { setSelectedCellType(t); setSelectedCell(null); }}
              atp={stats.atp}
              wave={stats.wave}
            />
          </div>
        </div>
      )}

    </div>
  );
}
