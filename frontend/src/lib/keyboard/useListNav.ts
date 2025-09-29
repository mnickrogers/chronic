"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard } from "@/lib/keyboard/KeyboardProvider";

export type ListNavOptions = {
  loop?: boolean;
  /** Called when Enter or 'o' on an item */
  onOpen?: (index: number) => void;
  /** Called on 'x' */
  onToggle?: (index: number) => void;
  /** Called on 'n' */
  onNew?: () => void;
};

export function useListNav(count: number, opts: ListNavOptions = {}) {
  const { registerScope } = useKeyboard();
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerIdRef = useRef(`kb-list-${Math.random().toString(36).slice(2)}`);
  const itemIdsRef = useRef<string[]>([]);

  useEffect(() => {
    // Adjust active index as list size changes, but do not auto-select when becoming non-empty
    if (count === 0) setActiveIndex(-1);
    else if (activeIndex >= count) setActiveIndex(count - 1);
  }, [count]);

  const clamp = (i: number) => {
    if (count === 0) return -1;
    if (opts.loop) {
      const n = ((i % count) + count) % count; // positive modulo
      return n;
    }
    return Math.max(0, Math.min(count - 1, i));
  };

  useEffect(() => {
    const reg = registerScope((evt) => {
      const { input, sequence } = evt;
      if (count === 0) return false;
      // Movement
      if (!input.ctrlKey && !input.metaKey && !input.altKey) {
        if (input.key === "Escape") { if (activeIndex >= 0) { setActiveIndex(-1); return true; } }
        if (sequence === "gg") { setActiveIndex(0); return true; }
        if (input.key === "G") { setActiveIndex(count - 1); return true; }
        if (input.key === "j" || input.key === "ArrowDown" || input.key === "k" || input.key === "ArrowUp") {
          if (activeIndex < 0) { setActiveIndex(0); return true; }
          if (input.key === "j" || input.key === "ArrowDown") { setActiveIndex(i => clamp(i + 1)); return true; }
          if (input.key === "k" || input.key === "ArrowUp") { setActiveIndex(i => clamp(i - 1)); return true; }
        }
        // Actions
        if (input.key === "Enter" || input.key === "o") { if (activeIndex >= 0) opts.onOpen?.(activeIndex); return true; }
        if (input.key === "x") { if (activeIndex >= 0) opts.onToggle?.(activeIndex); return true; }
        if (input.key === "n") { opts.onNew?.(); return true; }
      }
      return false;
    }, { priority: 5, active: true });
    return () => reg.unregister();
  }, [count, activeIndex, opts.onOpen, opts.onToggle, opts.onNew]);

  const getContainerProps = () => ({
    id: containerIdRef.current,
    role: "listbox",
    tabIndex: 0,
    "aria-activedescendant": activeIndex >= 0 ? itemIdsRef.current[activeIndex] : undefined,
  });

  const getItemProps = (index: number) => {
    const id = itemIdsRef.current[index] || `kb-item-${index}-${Math.random().toString(36).slice(2)}`;
    itemIdsRef.current[index] = id;
    return {
      id,
      role: "option",
      "data-kb-active": index === activeIndex ? "true" : undefined,
      "aria-selected": index === activeIndex || undefined,
    } as const;
  };

  return useMemo(() => ({ activeIndex, setActiveIndex, getContainerProps, getItemProps }), [activeIndex]);
}
