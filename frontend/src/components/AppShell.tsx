"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import SettingsDialog from "@/components/SettingsDialog";

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]" style={{ gridTemplateRows: "auto 1fr" }}>
      {/* Header spanning full width */}
      <div className="col-span-2 border-b border-[var(--stroke)] px-4 py-2">
        <div className="text-lg">Chronic</div>
      </div>

      {/* Sidebar */}
      <aside className="border-r border-[var(--stroke)] p-2 flex flex-col justify-between">
        <nav className="space-y-1 text-sm">
          <NavLink href="/tasks" label="All Tasks" active={isActive('/tasks')} />
          <NavLink href="/projects" label="Projects" active={isActive('/projects')} />
          <NavLink href="/tags" label="Tags" active={isActive('/tags')} />
        </nav>
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-2 button w-9 h-9 flex items-center justify-center text-[var(--stroke)]"
          title="Settings"
          aria-label="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-4 h-4"
            shapeRendering="geometricPrecision"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894a1.125 1.125 0 0 0 1.135.917l.905-.065a1.125 1.125 0 0 1 1.18.896l.211 1.063c.101.508.5.89.995.95l.916.11c.55.066.961.517.961 1.07v1.106c0 .553-.412 1.004-.961 1.07l-.916.11a1.125 1.125 0 0 0-.995.95l-.211 1.063a1.125 1.125 0 0 1-1.18.896l-.905-.065a1.125 1.125 0 0 0-1.135.917l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894a1.125 1.125 0 0 0-1.135-.917l-.905.065a1.125 1.125 0 0 1-1.18-.896l-.211-1.063a1.125 1.125 0 0 0-.995-.95l-.916-.11a1.125 1.125 0 0 1-.961-1.07V9.78c0-.553.412-1.004.961-1.07l.916-.11c.495-.06.894-.442.995-.95l.211-1.063a1.125 1.125 0 0 1 1.18-.896l.905.065c.57.041 1.065-.375 1.135-.917l.149-.894ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </button>
      </aside>

      {/* Main content area: prevent layout from creating page-wide horizontal scroll.
          Board views handle their own horizontal scrolling inside. */}
      <main className="p-4 min-w-0 overflow-x-hidden">{children}</main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`block px-3 py-2 border border-transparent rounded-sm ${
        active ? 'border-[var(--stroke)] bg-[var(--bg-2)]' : 'hover:border-[var(--stroke)]'
      }`}
    >
      {label}
    </Link>
  );
}
