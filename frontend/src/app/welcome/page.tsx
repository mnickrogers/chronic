"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";

export default function Welcome() {
  const { session } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already have a workspace, skip straight to tasks
  useEffect(() => {
    (async () => {
      try {
        const wss = await api.listWorkspaces();
        if (wss && (wss as any[]).length > 0) {
          const id = (wss as any[])[0].id;
          if (typeof window !== 'undefined') localStorage.setItem('currentWorkspaceId', id);
          router.replace('/tasks');
        }
      } catch {}
    })();
  }, [router]);

  // We intentionally do not redirect to /login here while the session
  // is still loading, to avoid bouncing right after signup. If the user
  // is unauthenticated, API calls will fail and we can show an error.

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const ws = await api.createWorkspace(name.trim());
      if (typeof window !== 'undefined') localStorage.setItem('currentWorkspaceId', (ws as any).id);
      router.replace('/tasks');
    } catch (e: any) {
      setError(e?.message || 'Failed to create workspace');
      setSubmitting(false);
    }
  };

  // Render minimal standalone view (no AppShell) for first-run
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="frame w-full max-w-md p-6 bg-[var(--bg-2)]">
        <h1 className="text-xl mb-2">Name your workspace</h1>
        <p className="text-sm opacity-80 mb-4">You can invite teammates later; this just helps organize your projects.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block mb-1 text-sm">Workspace name</label>
            <input
              className="input w-full"
              placeholder="e.g., Acme Design, Growth Team"
              value={name}
              onChange={(e)=>setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          <button className="button w-full" type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
