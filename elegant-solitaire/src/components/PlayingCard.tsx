import type React from 'react';
import { motion } from 'motion/react';
import { CardData } from '../gameLogic';

interface Props {
  card: CardData;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function PlayingCard({ card, isSelected, onClick, className = '', style }: Props) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  // Deeper, more elegant red and softer black
  const colorClass = isRed ? 'text-[#a71919]' : 'text-[#1c1917]';
  const suitChar = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit];
  const rankChar = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[card.rank] || card.rank;

  if (!card.faceUp) {
    return (
      <motion.div
        layout
        layoutId={card.id}
        onClick={onClick}
        style={style}
        className={`w-full aspect-[2/3] rounded shadow-[0_4px_12px_rgba(0,0,0,0.8)] md:rounded-lg cursor-pointer 
          bg-gradient-to-br from-[#18181b] to-[#09090b]
          border border-slate-700/80
          hover:brightness-110 transition-all 
          relative overflow-hidden
          ${className}`}
      >
        <div className="absolute inset-1 md:inset-1.5 border border-slate-600/40 rounded-sm md:rounded-md pointer-events-none" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_transparent_20%,_#000000_150%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.04] bg-[url('data:image/svg+xml,%3Csvg width=\\'8\\' height=\\'8\\' viewBox=\\'0 0 8 8\\' xmlns=\\'http://www.w3.org/2000/svg\\'%3E%3Cpath d=\\'M0 0h8v8H0z\\' fill=\\'none\\'/%3E%3Cpath d=\\'M0 0h1v1H0zM7 7h1v1H7z\\' fill=\\'%23ffffff\\'/%3E%3C/svg%3E')] pointer-events-none" />
        
        {/* Subtle premium accent logo/mark in center of back */}
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
          <div className="w-8 h-8 md:w-12 md:h-12 border-[1.5px] border-[#d4af37] rounded-sm rotate-45 flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.2)]">
            <div className="w-3 h-3 md:w-5 md:h-5 border border-[#d4af37] rounded-sm shadow-inner"></div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      layoutId={card.id}
      onClick={onClick}
      style={style}
      // Very soft, premium warm paper white
      className={`w-full aspect-[2/3] rounded shadow-[0_2px_8px_rgba(0,0,0,0.4)] md:rounded-lg bg-[#fdfbf7] border border-slate-300/80 cursor-pointer flex flex-col justify-between p-1 md:p-1.5 transition-all
        ${isSelected ? 'ring-[2px] ring-[#d4af37] ring-offset-[1px] md:ring-offset-2 ring-offset-[#18181b] z-50 scale-[1.02] shadow-[0_10px_30px_rgba(212,175,55,0.25)] -translate-y-1' : 'hover:shadow-[0_6px_20px_rgba(0,0,0,0.5)]'}
        ${className}`}
    >
      <div className={`text-[11px] md:text-sm font-bold ${colorClass} leading-[0.9] flex flex-col items-center w-fit font-serif tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]`}>
        <span>{rankChar}</span>
        <span className="-mt-[1px] md:-mt-[2px] text-[13px] md:text-base">{suitChar}</span>
      </div>

      <div className={`text-3xl sm:text-4xl md:text-6xl self-center ${colorClass} drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]`}>
        {suitChar}
      </div>

      <div className={`text-[11px] md:text-sm font-bold ${colorClass} leading-[0.9] flex flex-col items-center w-fit self-end rotate-180 font-serif tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]`}>
        <span>{rankChar}</span>
        <span className="-mt-[1px] md:-mt-[2px] text-[13px] md:text-base">{suitChar}</span>
      </div>
    </motion.div>
  );
}
