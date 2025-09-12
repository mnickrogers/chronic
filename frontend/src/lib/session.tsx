"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

type Session = { user: { id: string; email: string; display_name: string; first_name?: string; last_name?: string; theme: 'nord'|'dust'|'forest'|'sunset' }, org: { id: string, name: string } } | null;

const SessionCtx = createContext<{ session: Session, refresh: () => Promise<void> }>({ session: null, refresh: async () => {} });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const refresh = async () => {
    try { setSession(await api.me()); } catch { setSession(null); }
  };
  useEffect(() => { refresh(); }, []);
  return <SessionCtx.Provider value={{ session, refresh }}>{children}</SessionCtx.Provider>;
}

export function useSession() { return useContext(SessionCtx); }
