"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [projects, setProjects] = useState<any[]>([]);
  const [name, setName] = useState('');

  useEffect(() => { if (!id) return; api.listProjects(id).then(setProjects); }, [id]);

  const create = async () => {
    const pr = await api.createProject(id, name || 'Project');
    setProjects([...projects, pr]);
    setName('');
  };

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="text-lg">Chronic</div>
        <Link className="button" href="/">All Workspaces</Link>
      </header>

      <div className="frame p-4 bg-[var(--bg-2)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-md">Projects</h2>
          <div className="flex gap-2">
            <input className="input" placeholder="New project" value={name} onChange={e=>setName(e.target.value)} />
            <button className="button" onClick={create}>Create</button>
          </div>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map(p => (
            <li key={p.id} className="frame bg-[var(--bg-1)] p-3 hover:border-[var(--accent)]">
              <div className="flex items-center justify-between">
                <div className="text-sm">{p.name}</div>
                <Link className="button" href={`/p/${p.id}`}>Open</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
