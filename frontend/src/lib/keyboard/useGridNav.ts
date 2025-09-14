"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@/lib/keyboard/KeyboardProvider";

export type GridShape = {
  cols: number;
  rowsByCol: (col: number) => number; // returns count for column
};

export type GridNavOptions = {
  loopCols?: boolean;
  loopRows?: boolean;
  onOpen?: (pos: { col: number; row: number }) => void;
  onToggle?: (pos: { col: number; row: number }) => void;
  onNewInCol?: (col: number) => void;
};

export function useGridNav(shape: GridShape, opts: GridNavOptions = {}) {
  const { registerScope } = useKeyboard();
  const [active, setActive] = useState<{ col: number; row: number } | null>(null);
  const itemId = useRef<string>(`kb-grid-${Math.random().toString(36).slice(2)}`);
  const idFor = (col: number, row: number) => `${itemId.current}-${col}-${row}`;

  const clampCol = (c: number) => {
    const max = shape.cols - 1;
    if (shape.cols <= 0) return 0;
    if (opts.loopCols) {
      return ((c % shape.cols) + shape.cols) % shape.cols;
    }
    return Math.max(0, Math.min(max, c));
  };
  const clampRow = (c: number, r: number) => {
    const rows = shape.rowsByCol(c);
    if (rows <= 0) return 0;
    if (opts.loopRows) {
      return ((r % rows) + rows) % rows;
    }
    return Math.max(0, Math.min(rows - 1, r));
  };

  useEffect(() => {
    const reg = registerScope((evt) => {
      const { input, sequence } = evt;
      if (!input.ctrlKey && !input.metaKey && !input.altKey) {
        if (input.key === "Escape") { if (active) { setActive(null); return true; } }
        if (sequence === "gg") { setActive({ col: 0, row: 0 }); return true; }
        if (input.key === "G") {
          if (!active) { const bottom = Math.max(0, shape.rowsByCol(0) - 1); setActive({ col: 0, row: bottom }); return true; }
          setActive(p => ({ col: (p as any).col, row: Math.max(0, shape.rowsByCol((p as any).col) - 1) }));
          return true;
        }
        if (input.key === "h" || input.key === "ArrowLeft") {
          if (!active) { setActive({ col: 0, row: 0 }); return true; }
          setActive(p => {
            const nextCol = clampCol((p as any).col - 1);
            return { col: nextCol, row: clampRow(nextCol, (p as any).row) };
          });
          return true;
        }
        if (input.key === "l" || input.key === "ArrowRight") {
          if (!active) { setActive({ col: 0, row: 0 }); return true; }
          setActive(p => {
            const nextCol = clampCol((p as any).col + 1);
            return { col: nextCol, row: clampRow(nextCol, (p as any).row) };
          });
          return true;
        }
        if (input.key === "j" || input.key === "ArrowDown") {
          if (!active) { setActive({ col: 0, row: 0 }); return true; }
          setActive(p => ({ col: (p as any).col, row: clampRow((p as any).col, (p as any).row + 1) }));
          return true;
        }
        if (input.key === "k" || input.key === "ArrowUp") {
          if (!active) { setActive({ col: 0, row: 0 }); return true; }
          setActive(p => ({ col: (p as any).col, row: clampRow((p as any).col, (p as any).row - 1) }));
          return true;
        }
        if (input.key === "Enter" || input.key === "o") { if (active) opts.onOpen?.(active); return true; }
        if (input.key === "x") { if (active) opts.onToggle?.(active); return true; }
        if (input.key === "n") { opts.onNewInCol?.(active ? active.col : 0); return true; }
      }
      return false;
    }, { priority: 5, active: true });
    return () => reg.unregister();
  }, [shape.cols, opts.onOpen, opts.onToggle, opts.onNewInCol, active]);

  const getContainerProps = () => ({
    role: "grid",
    tabIndex: 0,
    "aria-activedescendant": active ? idFor(active.col, active.row) : undefined,
  });
  const getCardProps = (col: number, row: number) => ({
    id: idFor(col, row),
    role: "gridcell",
    "data-kb-active": active && active.col === col && active.row === row ? "true" : undefined,
    "aria-selected": active && active.col === col && active.row === row || undefined,
  } as const);

  return useMemo(() => ({ active, setActive, getContainerProps, getCardProps }), [active]);
}
