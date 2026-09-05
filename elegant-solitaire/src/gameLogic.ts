export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface CardData {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type GameState = {
  stock: CardData[];
  waste: CardData[];
  foundation: CardData[][];
  tableau: CardData[][];
  score: number;
  moves: number;
};

export function createDeck(): CardData[] {
  const deck: CardData[] = [];
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}-${rank}`, suit, rank: rank as Rank, faceUp: false });
    }
  }
  return deck;
}

export function deal(): GameState {
  const deck = createDeck();
  
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const tableau: CardData[][] = Array.from({ length: 7 }, () => []);
  for (let i = 0; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      const card = deck.pop()!;
      if (j === i) card.faceUp = true;
      tableau[j].push(card);
    }
  }

  return {
    stock: deck,
    waste: [],
    foundation: [[], [], [], []],
    tableau,
    score: 0,
    moves: 0,
  };
}

// 組札の並び。空き枠に描いてある絵柄と対応させる
export const FOUNDATION_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

/**
 * 場札が全部表になった後、勝ちまで自動で片付けるための1手。
 * 進められなければ null を返す。
 *
 * 勝ちが確定してから52枚を手で運ばせるのが、このゲームで一番だるい作業なので、
 * まとめて片付ける手段を用意する。UIから切り離してあるのは、
 * 「必ず勝ちまで到達するか」を単体で確かめられるようにするため。
 */
export function autoFinishStep(st: GameState): GameState | null {
  const next: GameState = {
    ...st,
    foundation: st.foundation.map(p => [...p]),
    tableau: st.tableau.map(p => [...p]),
    stock: [...st.stock],
    waste: [...st.waste],
  };

  const foundationIdx = (card: CardData) => {
    const i = FOUNDATION_SUITS.indexOf(card.suit);
    const pile = next.foundation[i];
    const top = pile[pile.length - 1];
    if (!top) return card.rank === 1 ? i : -1;
    return top.rank + 1 === card.rank ? i : -1;
  };

  for (let i = 0; i < 7; i++) {
    const pile = next.tableau[i];
    const card = pile[pile.length - 1];
    if (!card || !card.faceUp) continue;
    const f = foundationIdx(card);
    if (f >= 0) {
      pile.pop();
      next.foundation[f].push(card);
      next.score += 15;
      next.moves += 1;
      return next;
    }
  }

  const wasteTop = next.waste[next.waste.length - 1];
  if (wasteTop) {
    const f = foundationIdx(wasteTop);
    if (f >= 0) {
      next.waste.pop();
      next.foundation[f].push(wasteTop);
      next.score += 10;
      next.moves += 1;
      return next;
    }
  }

  // どこにも送れる札が無いなら、めくり続けても無駄。ここで打ち切らないと
  // 山札とめくり札を延々と往復して止まらなくなる。
  const sendable = (c: CardData) => foundationIdx(c) >= 0;
  if (!next.stock.some(sendable) && !next.waste.some(sendable)) return null;

  // 送れる札が表に無ければ山札をめくる。山札も尽きたら戻して1周させる
  if (next.stock.length) {
    next.waste.push({ ...next.stock.pop()!, faceUp: true });
    return next;
  }
  if (next.waste.length) {
    next.stock = next.waste.reverse().map(c => ({ ...c, faceUp: false }));
    next.waste = [];
    return next;
  }
  return null;
}

export const isWinState = (st: GameState) => st.foundation.every(p => p.length === 13);
