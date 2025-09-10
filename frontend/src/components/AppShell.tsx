"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

/**
 * AppShell renders the persistent left navigation and header chrome
 * to match the PRD mocks (Chronic title, All Tasks, Projects).
 * It also discovers and stores a "current workspace" id in localStorage
 * so that All Tasks/Projects can operate without an explicit ws param.
 */
export function useCurrentWorkspace() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  // Coordinate concurrent hook callers so we don't create duplicate workspaces
  // across different components mounting at the same time.
  // Module-scope variable persists per bundle instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyGlobal = globalThis as any;
  if (!anyGlobal.__wsInitPromise) anyGlobal.__wsInitPromise = null as Promise<string | null> | null;
  useEffect(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceId') : null;
    if (cached) { setWorkspaceId(cached); return; }
    (async () => {
      try {
        // If another caller is already initializing, reuse that promise
        if (anyGlobal.__wsInitPromise) {
          const idFromOther = await anyGlobal.__wsInitPromise;
          if (idFromOther) { localStorage.setItem('currentWorkspaceId', idFromOther); setWorkspaceId(idFromOther); }
          return;
        }

        anyGlobal.__wsInitPromise = (async () => {
          const wss = await api.listWorkspaces();
          let id = wss?.[0]?.id || null;
          if (!id) {
            // Auto-provision a default workspace for first-run UX
            const created = await api.createWorkspace('My Workspace');
            id = (created as any).id || null;
          }
          return id;
        })();

        const id = await anyGlobal.__wsInitPromise;
        anyGlobal.__wsInitPromise = null;
        if (id) { localStorage.setItem('currentWorkspaceId', id); setWorkspaceId(id); }
      } catch {}
    })();
  }, []);
  return { workspaceId, setWorkspaceId } as const;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Ensure a workspace is cached early for routes that need it
  useCurrentWorkspace();

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]" style={{ gridTemplateRows: "auto 1fr" }}>
      {/* Header spanning full width */}
      <div className="col-span-2 border-b border-[var(--stroke)] px-4 py-2">
        <div className="text-lg">Chronic</div>
      </div>

      {/* Sidebar */}
      <aside className="border-r border-[var(--stroke)] p-2">
        <nav className="space-y-1 text-sm">
          <NavLink href="/tasks" label="All Tasks" active={isActive('/tasks')} />
          <NavLink href="/projects" label="Projects" active={isActive('/projects')} />
        </nav>
      </aside>

      {/* Main content area */}
      <main className="p-4">{children}</main>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 border border-transparent rounded-sm ${
        active ? 'border-[var(--stroke)] bg-[#2B2B31]' : 'hover:border-[var(--stroke)]'
      }`}
    >
      {label}
    </Link>
  );
}
