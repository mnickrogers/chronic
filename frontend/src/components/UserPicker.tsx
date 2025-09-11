"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Member = { user: { id: string; email: string; display_name: string }, role: string };

export default function UserPicker({
  workspaceId,
  onSelect,
  allowInvite=true,
  autoFocus=true,
  placeholder='Search by name or email…',
}:{
  workspaceId: string;
  onSelect: (user: { id: string; email: string; display_name: string }) => void;
  allowInvite?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}){
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!workspaceId) return; api.listWorkspaceMembers(workspaceId).then(setMembers).catch(()=>{}); }, [workspaceId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => m.user.display_name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q));
  }, [members, query]);

  const isEmail = (s:string) => /.+@.+\..+/.test(s);
  const existingEmail = useMemo(() => members.find(m => m.user.email.toLowerCase() === query.trim().toLowerCase())?.user, [members, query]);

  const invite = async () => {
    if (!allowInvite) return;
    const email = query.trim();
    if (!isEmail(email)) return;
    setBusy(true);
    try {
      const added = await api.addWorkspaceMember(workspaceId, { email });
      const u = (added as any).user;
      setMembers(prev => [...prev, added as any]);
      onSelect(u);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-[var(--stroke)] rounded-sm bg-[#2B2B31]">
      <input
        className="input w-full border-b border-[var(--stroke)]"
        placeholder={placeholder}
        value={query}
        onChange={e=>setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      <div className="max-h-56 overflow-auto">
        {filtered.map(m => (
          <button key={m.user.id} className="w-full text-left px-3 py-2 hover:bg-[#222227] flex items-center gap-2" onClick={()=>onSelect(m.user)}>
            <span className="rounded-full bg-[#3A3A45] w-5 h-5 text-[10px] text-center leading-5">
              {m.user.display_name.split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('')}
            </span>
            <span className="truncate">
              <div className="text-sm leading-tight">{m.user.display_name}</div>
              <div className="text-xs opacity-70 leading-tight">{m.user.email}</div>
            </span>
          </button>
        ))}
        {allowInvite && isEmail(query) && !existingEmail && (
          <button className="w-full text-left px-3 py-2 hover:bg-[#222227] text-sm" onClick={invite} disabled={busy}>
            {busy ? 'Inviting…' : `Invite ${query.trim()} to workspace`}
          </button>
        )}
        {filtered.length === 0 && (!allowInvite || !isEmail(query)) && (
          <div className="px-3 py-2 text-sm opacity-70">No matches</div>
        )}
      </div>
    </div>
  );
}

