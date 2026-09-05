import React, { useRef, useEffect, useState } from 'react';
import { GameEngine } from '../game/GameEngine';
import { TILE_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT, CELL_DEFINITIONS, CellType } from '../game/constants';
import { Cell } from '../game/entities/Cell';
import { BG_URL } from '../bg';

type Pt = { x: number; y: number };

interface Props {
  engine: GameEngine;
  selectedCellType: CellType | null;
  onCellBuilt: () => void;
  selectedCell: Cell | null;
  onSelectCell: (cell: Cell | null) => void;
}

export const GameCanvas: React.FC<Props> = ({ engine, selectedCellType, onCellBuilt, selectedCell, onSelectCell }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<HTMLDivElement>(null);

  const selectedCellRef = useRef<Cell | null>(null);
  selectedCellRef.current = selectedCell;

  const pointers = useRef<Map<number, { x: number, y: number }>>(new Map());
  const transform = useRef({ x: 0, y: 0, scale: 1 });
  const initialPinchDist = useRef<number>(0);
  const initialTransform = useRef({ x: 0, y: 0, scale: 1 });
  const initialPinchCenter = useRef({ x: 0, y: 0 });
  const lastPanPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let reqId: number;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Map
      const map = engine.map;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;

      // Grid
      for (let y = 0; y < map.grid.length; y++) {
        for (let x = 0; x < map.grid[y].length; x++) {
          if (map.grid[y][x] === 1) { // Path
            ctx.fillStyle = 'rgba(200, 50, 50, 0.3)';
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      // Draw Cells (Towers)
      engine.cells.forEach(cell => {
        const def = CELL_DEFINITIONS[cell.type];

        // 射程は選んだ1体だけ描く。全体に常時描いていたので、
        // 数が増えるほど盤面が白く濁って敵が見えなくなっていた
        if (cell === selectedCellRef.current) {
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, def.range * engine.globalRangeMultiplier, 0, Math.PI * 2);
          ctx.fillStyle = cell.type === 'HelperTCell' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(56, 189, 248, 0.10)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, TILE_SIZE * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = cell === selectedCellRef.current ? '#7dd3fc' : '#fff';
        ctx.lineWidth = cell === selectedCellRef.current ? 3 : 2;
        ctx.stroke();

        if (cell.damageMultiplier > 1) {
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, TILE_SIZE * 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.stroke();
        }
      });

      // Draw Pathogens
      engine.pathogens.forEach(p => {
        ctx.fillStyle = p.type === 'BossPathogen' ? '#dc2626' : (p.type === 'Superbug' ? '#9333ea' : (p.type === 'Virus' ? '#f59e0b' : '#16a34a'));
        const size = p.type === 'BossPathogen' ? TILE_SIZE * 0.6 : (p.type === 'Superbug' ? TILE_SIZE * 0.5 : TILE_SIZE * 0.3);

        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();

        // HP Bar
        ctx.fillStyle = 'red';
        ctx.fillRect(p.x - size, p.y - size - 6, size * 2, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(p.x - size, p.y - size - 6, (size * 2) * (p.hp / p.maxHp), 4);

        if (p.slowTimer > 0) {
          ctx.fillStyle = 'rgba(167, 139, 250, 0.5)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw Projectiles
      engine.projectiles.forEach(p => {
        const def = CELL_DEFINITIONS[p.type];
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();

        if (p.splashRadius) {
           ctx.beginPath();
           ctx.arc(p.x, p.y, p.splashRadius, 0, Math.PI * 2);
           ctx.strokeStyle = `rgba(248, 113, 113, 0.2)`;
           ctx.stroke();
        }
      });

      // Draw Effects
      engine.effects.forEach(eff => {
        const progress = 1 - (eff.timer / eff.maxTimer);
        ctx.save();
        if (eff.type === 'damageText' && eff.text) {
          ctx.fillStyle = `rgba(239, 68, 68, ${1 - progress})`; // red-500 fading out
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(eff.text, eff.x, eff.y - (progress * 20));
        } else if (eff.type === 'explosion') {
          ctx.beginPath();
          ctx.arc(eff.x, eff.y, 10 + progress * 20, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253, 224, 71, ${1 - progress})`; // yellow-300 fading out
          ctx.fill();
        }
        ctx.restore();
      });

      reqId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(reqId);
    };
  }, [engine]);

  // Responsive base scale on mount and resize
  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (pointers.current.size > 0) return; // Don't snap while interacting

      const vWidth = entries[0].contentRect.width;
      const initialScale = vWidth / CANVAS_WIDTH;
      updateTransform(0, 0, initialScale);
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  const clampTransform = (x: number, y: number, scale: number) => {
    if (!viewportRef.current) return { x, y, scale };
    const vWidth = viewportRef.current.clientWidth;
    const vHeight = viewportRef.current.clientHeight;
    const cWidth = CANVAS_WIDTH * scale;
    const cHeight = CANVAS_HEIGHT * scale;

    // Allow panning slightly into the "black world" (2 tiles worth)
    const margin = TILE_SIZE * scale * 2;

    let minX, maxX, minY, maxY;

    if (cWidth >= vWidth) {
      minX = vWidth - cWidth - margin;
      maxX = margin;
    } else {
      minX = -margin;
      maxX = vWidth - cWidth + margin;
    }

    if (cHeight >= vHeight) {
      minY = vHeight - cHeight - margin;
      maxY = margin;
    } else {
      minY = -margin;
      maxY = vHeight - cHeight + margin;
    }

    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
      scale
    };
  };

  const updateTransform = (x: number, y: number, scale: number) => {
    const clamped = clampTransform(x, y, scale);
    transform.current = clamped;
    if (transformerRef.current) {
      transformerRef.current.style.transform = `translate(${clamped.x}px, ${clamped.y}px) scale(${clamped.scale})`;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // 携帯(タッチ操作)のみパン・ズームを有効化
    if (e.pointerType !== 'touch') return;
    if (selectedCellType) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts: Pt[] = Array.from(pointers.current.values());
      initialPinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialTransform.current = { ...transform.current };
      initialPinchCenter.current = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
    } else if (pointers.current.size === 1) {
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || selectedCellType) return;
    if (!pointers.current.has(e.pointerId)) return;

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts: Pt[] = Array.from(pointers.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const currentCenter = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };

      const scaleDelta = currentDist / initialPinchDist.current;
      let newScale = initialTransform.current.scale * scaleDelta;

      const fitScale = viewportRef.current ? viewportRef.current.clientWidth / CANVAS_WIDTH : 1;
      newScale = Math.max(fitScale * 0.5, Math.min(newScale, fitScale * 3));

      const viewportRect = viewportRef.current?.getBoundingClientRect();
      if (viewportRect) {
        const originX = initialPinchCenter.x - viewportRect.left;
        const originY = initialPinchCenter.y - viewportRect.top;
        const scaleRatio = newScale / initialTransform.current.scale;

        const newX = currentCenter.x - viewportRect.left - (originX - initialTransform.current.x) * scaleRatio;
        const newY = currentCenter.y - viewportRect.top - (originY - initialTransform.current.y) * scaleRatio;

        updateTransform(newX, newY, newScale);
      }
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };

      updateTransform(transform.current.x + dx, transform.current.y + dy, transform.current.scale);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    pointers.current.delete(e.pointerId);

    if (pointers.current.size === 1) {
      // Map の値を forEach で取り出す。Array.from だとこの lib 設定では
      // 要素の型が {} に落ちて型検査を通らない
      pointers.current.forEach(v => { lastPanPos.current = { x: v.x, y: v.y }; });
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    if (selectedCellType) {
      if (engine.buildCell(selectedCellType, gridX, gridY)) onCellBuilt();
      return;
    }

    // 置いた細胞を押したら選択する。射程の確認と売却の入口
    const hit = engine.cells.find(c => c.gridX === gridX && c.gridY === gridY) || null;
    onSelectCell(hit);
  };

  return (
    <div
      ref={viewportRef}
      className={`relative rounded-lg overflow-hidden shadow-2xl border-2 border-slate-700 w-full bg-slate-950 ${!selectedCellType ? 'touch-none' : ''}`}
      style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        ref={transformerRef}
        className="absolute top-0 left-0 origin-top-left will-change-transform"
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        {/* 移動で生じた黒い世界にもマス目を表示 (無限グリッド) */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: -4000, top: -4000, right: -4000, bottom: -4000,
            backgroundSize: `${TILE_SIZE}px ${TILE_SIZE}px`,
            backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundPosition: '0 0'
          }}
        />

        {/* マップ背景 */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
          style={{ backgroundImage: `url(${BG_URL})` }}
        />

        {/* ゲームキャンバス */}
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleCanvasClick}
          className={`absolute inset-0 z-10 ${selectedCellType ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)' }}
        />
      </div>
    </div>
  );
};
