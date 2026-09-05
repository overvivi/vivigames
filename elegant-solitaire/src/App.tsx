import { useState, useEffect, useRef } from 'react';
import { GameState, CardData, FOUNDATION_SUITS, autoFinishStep, isWinState } from './gameLogic';
import { dealSolvable } from './solver';
import { PlayingCard } from './components/PlayingCard';
import { RotateCcw, Undo2, Play, Trophy, Clock, FastForward, Volume2, VolumeX, ChevronLeft } from 'lucide-react';
import { audio } from './audio';
import confetti from 'canvas-confetti';

type Selection = {
  source: 'waste' | 'foundation' | 'tableau';
  pileIdx: number;
  cardIdx: number;
} | null;

export default function App() {
  // 配牌は「最後まで解けると確かめた」ものだけを使う。
  // 初手から詰んでいる盤面を掴まされるのが、このゲームで一番つまらないため。
  const [state, setState] = useState<GameState>(() => dealSolvable());
  const [autoRunning, setAutoRunning] = useState(false);
  const [muted, setMuted] = useState(audio.muted);
  const [history, setHistory] = useState<GameState[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioInitialized = useRef(false);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const initInteraction = () => {
    if (!audioInitialized.current) {
      audio.init();
      audioInitialized.current = true;
    }
    if (!isPlaying) setIsPlaying(true);
  };

  const pushState = (newState: GameState) => {
    setHistory(prev => [...prev, state]);
    setState(newState);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    initInteraction();
    const prevState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setState(prevState);
    clearSelection();
    audio.move();
  };

  const handleNewGame = () => {
    initInteraction();
    setAutoRunning(false);
    setState(dealSolvable());
    setHistory([]);
    setSelection(null);
    setTime(0);
    setIsPlaying(true);
    audio.deal();
  };

  const clearSelection = () => setSelection(null);

  const getMovingCards = (sel: Selection, st: GameState): CardData[] => {
    if (!sel) return [];
    if (sel.source === 'waste') return st.waste.length ? [st.waste[st.waste.length - 1]] : [];
    if (sel.source === 'foundation') return st.foundation[sel.pileIdx].length ? [st.foundation[sel.pileIdx][st.foundation[sel.pileIdx].length - 1]] : [];
    if (sel.source === 'tableau') return st.tableau[sel.pileIdx].slice(sel.cardIdx);
    return [];
  };

  const checkWin = (st: GameState) => {
    const isWin = st.foundation.every(pile => pile.length === 13);
    if (isWin) {
      setIsPlaying(false);
      audio.win();
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff']
      });
    }
  };

  const handleSmartTap = (source: 'waste' | 'tableau', pileIdx: number, cardIdx: number): boolean => {
    const st = state;
    let card: CardData;
    let movingCards: CardData[] = [];

    if (source === 'waste') {
      if (st.waste.length === 0) return false;
      card = st.waste[st.waste.length - 1];
      movingCards = [card];
    } else {
      card = st.tableau[pileIdx][cardIdx];
      movingCards = st.tableau[pileIdx].slice(cardIdx);
    }

    if (!card || !card.faceUp) return false;

    // 1. Foundation
    if (movingCards.length === 1) {
      for (let i = 0; i < 4; i++) {
        const targetPile = st.foundation[i];
        const topTarget = targetPile[targetPile.length - 1];
        let canMove = false;

        if (!topTarget) canMove = card.rank === 1 && card.suit === FOUNDATION_SUITS[i];
        else canMove = topTarget.suit === card.suit && topTarget.rank + 1 === card.rank;

        if (canMove) {
          const newState = { ...st, foundation: [...st.foundation], tableau: [...st.tableau], waste: [...st.waste] };
          if (source === 'waste') newState.waste.pop();
          else newState.tableau[pileIdx] = newState.tableau[pileIdx].slice(0, cardIdx);

          newState.foundation[i] = [...newState.foundation[i], card];
          newState.score += (source === 'waste' ? 10 : 15);
          newState.moves += 1;

          pushState(newState);
          audio.score();
          checkWin(newState);
          return true;
        }
      }
    }

    // 2. Tableau
    for (let i = 0; i < 7; i++) {
      if (source === 'tableau' && i === pileIdx) continue;

      const targetPile = st.tableau[i];
      const topTarget = targetPile[targetPile.length - 1];
      let canMove = false;

      if (!topTarget && card.rank === 13) canMove = true;
      else if (topTarget) {
        const isCardRed = card.suit === 'hearts' || card.suit === 'diamonds';
        const isTargetRed = topTarget.suit === 'hearts' || topTarget.suit === 'diamonds';
        if (isCardRed !== isTargetRed && card.rank + 1 === topTarget.rank) {
          canMove = true;
        }
      }

      if (canMove) {
        const newState = { ...st, foundation: [...st.foundation], tableau: [...st.tableau], waste: [...st.waste] };
        if (source === 'waste') newState.waste.pop();
        else newState.tableau[pileIdx] = newState.tableau[pileIdx].slice(0, cardIdx);

        newState.tableau[i] = [...newState.tableau[i], ...movingCards];
        newState.moves += 1;
        if (source === 'waste') newState.score += 5;

        pushState(newState);
        audio.move();
        return true;
      }
    }

    return false;
  };

  const handleStockClick = () => {
    initInteraction();
    clearSelection();
    const newState = { ...state, stock: [...state.stock], waste: [...state.waste] };
    if (newState.stock.length === 0) {
      if (newState.waste.length === 0) {
        audio.error();
        return;
      }
      newState.stock = newState.waste.reverse().map(c => ({ ...c, faceUp: false }));
      newState.waste = [];
      newState.moves += 1;
      newState.score = Math.max(0, newState.score - 20); // Penalty for deck reset
      audio.deal();
    } else {
      const card = newState.stock.pop()!;
      card.faceUp = true;
      newState.waste.push(card);
      newState.moves += 1;
      audio.move();
    }
    pushState(newState);
  };

  const handleWasteClick = () => {
    initInteraction();
    if (state.waste.length === 0) return;

    if (selection?.source === 'waste') {
      const moved = handleSmartTap('waste', 0, 0);
      clearSelection();
      if (!moved) audio.error();
    } else {
      setSelection({ source: 'waste', pileIdx: 0, cardIdx: state.waste.length - 1 });
      audio.move();
    }
  };

  const handleFoundationClick = (pileIdx: number) => {
    initInteraction();
    if (!selection) {
      if (state.foundation[pileIdx].length > 0) {
        setSelection({ source: 'foundation', pileIdx, cardIdx: state.foundation[pileIdx].length - 1 });
        audio.move();
      }
      return;
    }

    if (selection.source === 'foundation' && selection.pileIdx === pileIdx) {
      clearSelection();
      return;
    }

    const movingCards = getMovingCards(selection, state);
    if (movingCards.length !== 1) {
      audio.error();
      clearSelection();
      return;
    }

    const card = movingCards[0];
    const targetPile = state.foundation[pileIdx];
    const topTarget = targetPile[targetPile.length - 1];

    let isValid = false;
    if (!topTarget) {
      isValid = card.rank === 1 && card.suit === FOUNDATION_SUITS[pileIdx];
    } else {
      isValid = card.suit === topTarget.suit && card.rank === topTarget.rank + 1;
    }

    if (isValid) {
      const newState = { ...state, foundation: [...state.foundation], waste: [...state.waste], tableau: [...state.tableau] };
      if (selection.source === 'waste') newState.waste.pop();
      else if (selection.source === 'foundation') newState.foundation[selection.pileIdx].pop();
      else if (selection.source === 'tableau') newState.tableau[selection.pileIdx].splice(selection.cardIdx, 1);

      newState.foundation[pileIdx] = [...newState.foundation[pileIdx], card];
      newState.moves += 1;
      newState.score += 10;

      pushState(newState);
      clearSelection();
      audio.score();
      checkWin(newState);
    } else {
      audio.error();
      clearSelection();
    }
  };

  const handleTableauClick = (pileIdx: number, cardIdx: number) => {
    initInteraction();
    const pile = state.tableau[pileIdx];
    const card = pile[cardIdx];

    if (!selection) {
      if (!card || !card.faceUp) {
        if (card && cardIdx === pile.length - 1) {
          const newState = { ...state, tableau: [...state.tableau] };
          newState.tableau[pileIdx] = [...newState.tableau[pileIdx]];
          newState.tableau[pileIdx][cardIdx] = { ...newState.tableau[pileIdx][cardIdx], faceUp: true };
          newState.score += 5;
          pushState(newState);
          audio.move();
        }
        return;
      }
      setSelection({ source: 'tableau', pileIdx, cardIdx });
      audio.move();
      return;
    }

    if (selection.source === 'tableau' && selection.pileIdx === pileIdx && selection.cardIdx === cardIdx) {
      const moved = handleSmartTap('tableau', pileIdx, cardIdx);
      clearSelection();
      if (!moved) audio.error();
      return;
    }

    const movingCards = getMovingCards(selection, state);
    if (movingCards.length === 0) return;

    const bottomCard = movingCards[0];
    const targetPile = state.tableau[pileIdx];
    const topTarget = targetPile[targetPile.length - 1];

    let isValid = false;
    if (!topTarget) {
      isValid = bottomCard.rank === 13;
    } else {
      const isBottomRed = bottomCard.suit === 'hearts' || bottomCard.suit === 'diamonds';
      const isTopRed = topTarget.suit === 'hearts' || topTarget.suit === 'diamonds';
      isValid = isBottomRed !== isTopRed && bottomCard.rank === topTarget.rank - 1;
    }

    if (isValid) {
      const newState = { ...state, foundation: [...state.foundation], waste: [...state.waste], tableau: [...state.tableau] };
      if (selection.source === 'waste') newState.waste.pop();
      else if (selection.source === 'foundation') newState.foundation[selection.pileIdx].pop();
      else if (selection.source === 'tableau') {
        newState.tableau[selection.pileIdx] = newState.tableau[selection.pileIdx].slice(0, selection.cardIdx);
      }

      newState.tableau[pileIdx] = [...newState.tableau[pileIdx], ...movingCards];
      newState.moves += 1;
      // 組札から引き戻したら、送った時の点を返させる。
      // 無得点のままだと「戻す→送る」の往復で無限に加点できてしまう。
      if (selection.source === 'foundation') newState.score = Math.max(0, newState.score - 15);

      pushState(newState);
      clearSelection();
      audio.move();
    } else {
      if (card && card.faceUp) {
        setSelection({ source: 'tableau', pileIdx, cardIdx });
        audio.move();
      } else {
        clearSelection();
        audio.error();
      }
    }
  };

  const isWin = isWinState(state);
  // 裏向きが1枚も無ければ、あとは順番に送るだけで必ず終わる
  const canAutoFinish = !isWin && state.tableau.every(pile => pile.every(c => c.faceUp));

  useEffect(() => {
    if (!autoRunning) return;
    const id = setTimeout(() => {
      const next = autoFinishStep(state);
      if (!next) { setAutoRunning(false); return; }
      setState(next);
      if (isWinState(next)) {
        setAutoRunning(false);
        checkWin(next);
      }
    }, 70);
    return () => clearTimeout(id);
  }, [autoRunning, state]);
  const formatTime = (secs: number) => `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen p-2 md:p-4 flex flex-col items-center select-none overflow-x-hidden overflow-y-auto relative">
      <div className="bg-pattern" />
      <div className="w-full max-w-5xl flex flex-col gap-3 md:gap-6 z-10 pb-12">

        {/* Top Header & Stats */}
        <div className="flex flex-wrap justify-between items-center bg-[#18181b]/60 backdrop-blur-xl rounded-2xl p-3 md:p-4 border border-slate-800/80 shadow-2xl relative overflow-hidden gap-3">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d4af37]/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <a
              href="../index.html"
              className="flex items-center gap-1 text-slate-400 hover:text-[#d4af37] transition-colors shrink-0"
              aria-label="ゲーム置き場へ戻る"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline font-serif text-[11px] tracking-widest">BASE</span>
            </a>
            <h1 className="text-xl md:text-2xl font-extrabold text-[#d4af37] tracking-[0.2em] hidden lg:block font-serif drop-shadow-[0_2px_8px_rgba(212,175,55,0.4)]">
              SOLITAIRE
            </h1>
            <div className="flex gap-3 md:gap-5 text-slate-400 font-serif text-xs md:text-sm lg:text-base tracking-wide">
              <div className="flex items-center gap-1.5 md:gap-2">
                <Trophy className="w-3 h-3 md:w-4 md:h-4 text-[#d4af37]/80" />
                <span>SCORE <span className="text-slate-200 font-bold ml-1">{state.score}</span></span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <RotateCcw className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
                <span>MOVES <span className="text-slate-200 font-bold ml-1">{state.moves}</span></span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <Clock className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
                <span className="text-slate-200">{formatTime(time)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 relative z-10 ml-auto">
            {canAutoFinish && (
              <button
                onClick={() => { initInteraction(); clearSelection(); setAutoRunning(v => !v); }}
                className="p-2 md:px-4 md:py-2 rounded-xl bg-[#27272a]/80 text-[#d4af37] hover:bg-[#3f3f46] transition-all flex items-center gap-2 border border-[#d4af37]/40"
              >
                <FastForward className="w-4 h-4" />
                <span className="hidden sm:inline font-serif text-xs md:text-sm tracking-widest">
                  {autoRunning ? 'STOP' : 'AUTO'}
                </span>
              </button>
            )}
            <button
              onClick={() => { const v = !muted; audio.setMuted(v); setMuted(v); }}
              className="p-2 rounded-xl bg-[#27272a]/80 text-slate-400 hover:bg-[#3f3f46] hover:text-white transition-all border border-slate-700/50"
              aria-label="音のON/OFF"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className="p-2 md:px-4 md:py-2 rounded-xl bg-[#27272a]/80 text-slate-400 hover:bg-[#3f3f46] hover:text-white disabled:opacity-30 disabled:hover:bg-[#27272a]/80 transition-all flex items-center gap-2 border border-slate-700/50"
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden sm:inline font-serif text-xs md:text-sm tracking-widest">UNDO</span>
            </button>
            <button
              onClick={handleNewGame}
              className="p-2 md:px-4 md:py-2 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8860b] text-[#18181b] hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_2px_15px_rgba(212,175,55,0.3)] border border-[#fde047]/40"
            >
              <Play className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline font-serif font-bold text-xs md:text-sm tracking-widest">NEW GAME</span>
            </button>
          </div>
        </div>

        {/* Top Row: Stock, Waste, Foundations */}
        <div className="grid grid-cols-7 gap-2 md:gap-4 mt-2">

          {/* Stock */}
          <div
            className="relative w-full aspect-[2/3] rounded md:rounded-xl border border-slate-700/80 bg-slate-900/60 shadow-inner flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors"
            onClick={handleStockClick}
          >
            {state.stock.map((c, i) => {
              // 見えるのは一番上の数枚だけ。全枚数ぶんずらすと束が枠から出て、
              // 携帯では画面の外へ切れていた
              const fromTop = state.stock.length - 1 - i;
              if (fromTop > 3) return null;
              const shift = fromTop * 1.2;
              return (
                <div key={c.id} className="absolute inset-0" style={{ transform: `translate(${-shift}px, ${-shift}px)` }}>
                  <PlayingCard card={c} />
                </div>
              );
            })}
            {state.stock.length === 0 && <RotateCcw className="text-slate-700 w-8 h-8 md:w-10 md:h-10" />}
          </div>

          {/* Waste */}
          <div className="relative w-full aspect-[2/3] rounded md:rounded-xl">
            {state.waste.map((c, i) => {
              const isTop = i === state.waste.length - 1;
              const isSelectedCard = selection?.source === 'waste' && isTop;
              const visibleIndex = state.waste.length - i;
              const isVisible = visibleIndex <= 3;

              if (!isVisible) return null;

              const shiftIndex = Math.min(i, 2);
              const finalShift = state.waste.length > 3 ? (2 - (state.waste.length - 1 - i)) : i;

              return (
                <div
                  key={c.id}
                  className="absolute inset-0"
                  style={{
                    transform: `translateX(calc(${finalShift} * clamp(7px, 2.2vw, 24px)))`,
                    zIndex: i
                  }}
                >
                  <PlayingCard
                    card={c}
                    isSelected={isSelectedCard}
                    onClick={(e) => { e.stopPropagation(); isTop && handleWasteClick(); }}
                  />
                </div>
              );
            })}
          </div>

          <div className="col-span-1 opacity-0 pointer-events-none"></div>

          {/* Foundations */}
          {state.foundation.map((pile, pileIdx) => (
            <div
              key={`foundation-${pileIdx}`}
              className="relative w-full aspect-[2/3] rounded md:rounded-xl border border-slate-700/80 bg-slate-900/60 shadow-inner flex items-center justify-center cursor-pointer hover:bg-slate-800/80 transition-colors"
              onClick={() => pile.length === 0 && handleFoundationClick(pileIdx)}
            >
              {pile.length === 0 && (
                <span className="text-slate-800 text-3xl md:text-5xl font-serif drop-shadow-sm">
                  {['♥', '♦', '♣', '♠'][pileIdx]}
                </span>
              )}
              {pile.map((c, i) => {
                const isSelectedCard = selection?.source === 'foundation' && selection.pileIdx === pileIdx && i === pile.length - 1;
                return (
                  <div key={c.id} className="absolute inset-0">
                    <PlayingCard
                      card={c}
                      isSelected={isSelectedCard}
                      onClick={(e) => { e.stopPropagation(); handleFoundationClick(pileIdx); }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div className="grid grid-cols-7 gap-2 md:gap-4 mt-2">
          {state.tableau.map((pile, pileIdx) => (
            <div key={`tableau-${pileIdx}`} className="flex flex-col relative w-full items-center">
              {/* Empty pile placeholder */}
              <div
                className="absolute w-full aspect-[2/3] rounded md:rounded-xl border border-slate-700/80 bg-slate-900/60 shadow-inner cursor-pointer"
                onClick={() => pile.length === 0 && handleTableauClick(pileIdx, 0)}
              />

              {/* Cards in pile */}
              {pile.map((c, cardIdx) => {
                const isSelectedCard = selection?.source === 'tableau' && selection.pileIdx === pileIdx && cardIdx >= selection.cardIdx;
                const prev = cardIdx > 0 ? pile[cardIdx - 1] : null;

                // Mathematically perfect overlap using CSS variables based on aspect ratio 2/3 (-150%)
                const mt = cardIdx === 0 ? '0' : (prev?.faceUp ? 'var(--card-overlap-up)' : 'var(--card-overlap-down)');

                return (
                  <div
                    key={c.id}
                    className="relative z-10 w-full"
                    style={{ marginTop: mt }}
                  >
                    <PlayingCard
                      card={c}
                      isSelected={isSelectedCard}
                      onClick={(e) => { e.stopPropagation(); handleTableauClick(pileIdx, cardIdx); }}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

      </div>

      {/* Win Screen Overlay */}
      {isWin && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-[#d4af37]/30 p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] text-center max-w-md w-full relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_#d4af37_0%,_transparent_80%)] pointer-events-none" />
            <h2 className="text-4xl md:text-6xl font-extrabold text-[#d4af37] mb-2 font-serif tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
              VICTORY
            </h2>
            <div className="text-slate-400 text-lg mb-8 font-serif space-y-2 relative z-10">
              <p>You have mastered the deck.</p>
              <div className="flex justify-center gap-6 text-xl pt-4 font-sans font-bold">
                <span className="text-slate-300">Score: <span className="text-[#d4af37]">{state.score}</span></span>
                <span className="text-slate-300">Time: <span className="text-[#d4af37]">{formatTime(time)}</span></span>
              </div>
            </div>
            <button
              onClick={handleNewGame}
              className="w-full py-4 bg-gradient-to-r from-[#d4af37] to-[#b8860b] hover:from-[#eab308] hover:to-[#d4af37] active:scale-95 transition-all text-[#18181b] text-xl font-bold font-serif rounded-2xl shadow-lg uppercase tracking-widest relative z-10"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
