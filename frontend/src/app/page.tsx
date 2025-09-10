"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

export default function Home() {
  const { session } = useSession();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [name, setName] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (session === null) {
      // unauthenticated
      router.replace('/login');
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    api.listWorkspaces().then(setWorkspaces).catch(()=>{});
  }, [session]);

  const create = async () => {
    const ws = await api.createWorkspace(name || 'Workspace');
    setWorkspaces([...workspaces, ws]);
    setName('');
  };

  if (!session) return null;

  return (
    <div className="p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="text-lg">Chronic</div>
        <div className="text-sm opacity-80">{session?.org?.name}</div>
      </header>

      <div className="frame p-4 bg-[#2B2B31]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-md">Workspaces</h2>
          <div className="flex gap-2">
            <input className="input" placeholder="New workspace" value={name} onChange={e=>setName(e.target.value)} />
            <button className="button" onClick={create}>Create</button>
          </div>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {workspaces.map(ws => (
            <li key={ws.id} className="frame bg-[#222227] p-3 hover:border-[var(--accent)]">
              <div className="flex items-center justify-between">
                <div className="text-sm">{ws.name}</div>
                <Link className="button" href={`/w/${ws.id}`}>Open</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

