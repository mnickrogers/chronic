"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppShell, { useCurrentWorkspace } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useListNav } from "@/lib/keyboard/useListNav";

export default function ProjectsPage() {
  return (
    <AppShell>
      <ProjectsInner />
    </AppShell>
  );
}

function ProjectsInner() {
  const { workspaceId } = useCurrentWorkspace();
  const [projects, setProjects] = useState<any[]>([]);
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (!workspaceId) return; api.listProjects(workspaceId).then(setProjects).catch(()=>{}); }, [workspaceId]);

  const create = async () => {
    if (!workspaceId) return;
    const pr = await api.createProject(workspaceId, name || 'Project');
    setProjects([...projects, pr]);
    setName('');
  };

  const tilesCount = 1 + projects.length; // new-project tile + project cards
  const listNav = useListNav(tilesCount, {
    onOpen: (i) => {
      if (i === 0) {
        // focus name input
        nameRef.current?.focus();
      }
    },
    onNew: () => {
      nameRef.current?.focus();
    },
  });

  return (
    <div>
      <div className="mb-3 text-md">Projects</div>
      <div className="grid md:grid-cols-3 sm:grid-cols-2 gap-4" {...listNav.getContainerProps()}>
        <div className="frame bg-[var(--bg-2)] p-3 flex flex-col gap-2" {...listNav.getItemProps(0)}>
          <div className="text-sm opacity-80">New Project</div>
          <input ref={nameRef} className="input" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') create(); }} />
          <button className="button" onClick={create}>Create</button>
        </div>
        {projects.map((p, idx) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="frame bg-[var(--bg-2)] p-4 hover:border-[var(--accent)]" {...listNav.getItemProps(idx+1)}>
            <div className="text-md mb-4">{p.name}</div>
            <div className="text-sm opacity-80 space-y-1">
              <div className="flex justify-between"><span>Tasks Remaining:</span><span className="tabular-nums">—</span></div>
              <div className="flex justify-between"><span>Tasks Total:</span><span className="tabular-nums">—</span></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
