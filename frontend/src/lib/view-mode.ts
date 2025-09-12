"use client";
import { useEffect, useState } from "react";

export type TaskViewMode = "list" | "board";

const STORAGE_KEY = "chronic:taskViewMode";

export function useTaskViewMode(): [TaskViewMode, (m: TaskViewMode) => void] {
  const [mode, setMode] = useState<TaskViewMode>("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TaskViewMode | null;
      if (saved === "list" || saved === "board") setMode(saved);
    } catch {}
  }, []);

  const set = (m: TaskViewMode) => {
    setMode(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch {}
  };

  return [mode, set];
}

