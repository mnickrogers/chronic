"use client";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

export default function ThemeApplier() {
  const { session } = useSession();
  useEffect(() => {
    const theme = session?.user?.theme || 'nord';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [session?.user?.theme]);
  return null;
}

