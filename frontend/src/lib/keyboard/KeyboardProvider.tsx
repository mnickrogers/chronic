"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type KeyInput = {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

type KeyEventLike = {
  input: KeyInput;
  sequence?: string | null;
  /** Prevent further handling by lower-priority scopes and globals */
  stopPropagation: () => void;
  /** Whether propagation has been stopped */
  isPropagationStopped: () => boolean;
};

type ScopeHandler = (evt: KeyEventLike) => boolean | void;

type RegisteredScope = {
  id: number;
  handler: ScopeHandler;
  priority: number; // higher wins
  active: boolean;
};

type KeyboardContextShape = {
  registerScope: (handler: ScopeHandler, opts?: { priority?: number; active?: boolean }) => {
    setActive: (b: boolean) => void;
    unregister: () => void;
  };
  setSuspended: (s: boolean) => void;
  suspended: boolean;
  helpOpen: boolean;
  setHelpOpen: (b: boolean) => void;
};

const KeyboardCtx = createContext<KeyboardContextShape | null>(null);

export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  const scopesRef = useRef<RegisteredScope[]>([]);
  const idRef = useRef(1);
  const [suspended, setSuspended] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const seqRef = useRef<{ buffer: string; ts: number | null }>({ buffer: "", ts: null });

  const resetSeq = () => { seqRef.current = { buffer: "", ts: null }; };

  const registerScope = useCallback<KeyboardContextShape["registerScope"]>((handler, opts) => {
    const node: RegisteredScope = {
      id: idRef.current++,
      handler,
      priority: opts?.priority ?? 0,
      active: opts?.active ?? true,
    };
    scopesRef.current.push(node);
    // Keep highest priority last to iterate easily
    scopesRef.current.sort((a, b) => a.priority - b.priority);
    return {
      setActive: (b: boolean) => { node.active = b; },
      unregister: () => { scopesRef.current = scopesRef.current.filter(s => s.id !== node.id); },
    };
  }, []);

  // Utility to ignore when typing in inputs or contenteditable
  const isTypingTarget = (el: EventTarget | null) => {
    const node = el as HTMLElement | null;
    if (!node) return false;
    const tag = (node.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    // contenteditable element or inside one
    if ((node as any).isContentEditable) return true;
    const ce = node.closest("[contenteditable=''], [contenteditable='true']");
    return !!ce;
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (suspended) return;
      // If help overlay open, only allow '?' to close it
      if (helpOpen) {
        if (e.key === '?') { setHelpOpen(false); e.preventDefault(); }
        return;
      }
      if (isTypingTarget(e.target)) return;

      // Build KeyInput
      const input: KeyInput = {
        key: e.key,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      };

      const now = Date.now();
      // Maintain simple 'g' based sequence buffer (gt, gp, ga, gg)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const buf = seqRef.current.buffer;
        const age = seqRef.current.ts ? now - (seqRef.current.ts || 0) : Infinity;
        const within = age < 700;
        let sequence: string | null = null;

        if (input.key.toLowerCase() === "g") {
          // Start or continue a 'g' sequence
          if (within && buf === "g") {
            sequence = "gg";
            resetSeq();
          } else {
            seqRef.current = { buffer: "g", ts: now };
          }
        } else if (within && buf === "g") {
          const k = input.key.toLowerCase();
          if (["t", "p", "a"].includes(k)) {
            sequence = "g" + k;
            resetSeq();
          } else {
            // Unknown sequence; reset but continue processing this key normally
            resetSeq();
          }
        } else if (age >= 700 && buf) {
          resetSeq();
        }

        const stopped = { v: false };
        const evtLike: KeyEventLike = {
          input,
          sequence,
          stopPropagation: () => { stopped.v = true; },
          isPropagationStopped: () => stopped.v,
        };

        // Deliver to scopes, highest priority last
        for (let i = scopesRef.current.length - 1; i >= 0; i--) {
          const s = scopesRef.current[i];
          if (!s.active) continue;
          const handled = s.handler(evtLike);
          if (handled || evtLike.isPropagationStopped()) { e.preventDefault(); return; }
        }

        // Global help overlay toggle
        if (!sequence && !input.ctrlKey && !input.metaKey && !input.altKey && input.key === "?") {
          setHelpOpen(v => !v); e.preventDefault(); return;
        }

        // No scope handled: allow default behavior
      }
    };

    const onBlur = () => { resetSeq(); };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
      window.removeEventListener("blur", onBlur);
    };
  }, [suspended]);

  const value = useMemo(() => ({ registerScope, suspended, setSuspended, helpOpen, setHelpOpen }), [registerScope, suspended, helpOpen]);

  return (
    <KeyboardCtx.Provider value={value}>
      {children}
      {helpOpen ? <KeyboardHelp onClose={() => setHelpOpen(false)} /> : null}
    </KeyboardCtx.Provider>
  );
}

export function useKeyboard() {
  const ctx = useContext(KeyboardCtx);
  if (!ctx) throw new Error("useKeyboard must be used within KeyboardProvider");
  return ctx;
}

function KeyboardHelp({ onClose }: { onClose: () => void }) {
  // Click outside or Esc handled by global key; we accept click backdrop to close
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20" onClick={onClose}>
      <div className="frame bg-[var(--bg-2)] w-full max-w-xl" onClick={(e)=>e.stopPropagation()}>
        <div className="p-3 border-b border-[var(--stroke)] flex items-center justify-between">
          <div>Keyboard Shortcuts</div>
          <div className="text-xs opacity-70">Press ? to close</div>
        </div>
        <div className="p-4 text-sm grid grid-cols-2 gap-y-2 gap-x-4">
          <Section title="Navigation">
            <Row k="h / ←" d="Left" />
            <Row k="j / ↓" d="Down" />
            <Row k="k / ↑" d="Up" />
            <Row k="l / →" d="Right" />
            <Row k="gg / G" d="Top / Bottom" />
          </Section>
          <Section title="Actions">
            <Row k="Enter / o" d="Open" />
            <Row k="x" d="Toggle complete" />
            <Row k="n" d="New (context)" />
            <Row k="v" d="Toggle List/Board (Tasks)" />
          </Section>
          <Section title="Go To">
            <Row k="g t" d="All Tasks" />
            <Row k="g p" d="Projects" />
            <Row k="g a" d="Tags" />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="opacity-80 mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, d }: { k: string; d: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="kbd text-xs">{k}</div>
      <div className="opacity-80">{d}</div>
    </div>
  );
}
