"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";

type TabKey = "account" | "general";

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, refresh } = useSession();
  const [tab, setTab] = useState<TabKey>("account");
  const initial = {
    first: session?.user.first_name || "",
    last: session?.user.last_name || "",
    theme: (session?.user as any)?.theme || 'nord',
  } as const;

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [theme, setTheme] = useState<'nord'|'dust'|'forest'|'sunset'>(initial.theme);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset local state whenever dialog opens or session changes
  useEffect(() => {
    if (open) {
      setTab("account");
      setFirst(initial.first);
      setLast(initial.last);
      setTheme(initial.theme);
      setSaving(false);
      setErr(null);
    }
  }, [open, initial.first, initial.last, initial.theme]);

  // Live preview theme while dialog is open
  useEffect(() => {
    if (!open) return;
    const el = typeof document !== 'undefined' ? document.documentElement : null;
    if (!el) return;
    const prev = el.getAttribute('data-theme') || 'nord';
    el.setAttribute('data-theme', theme);
    return () => { el.setAttribute('data-theme', (session?.user as any)?.theme || prev || 'nord'); };
  }, [theme, open, session?.user]);

  if (!open) return null;

  const changedNames = first !== (session?.user.first_name || "") || last !== (session?.user.last_name || "");
  const changedTheme = theme !== ((session?.user as any)?.theme || 'nord');
  const canSave = !saving && (changedNames || changedTheme) && (first.trim().length > 0 || !changedNames);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      const body: any = {};
      if (changedNames) { body.first_name = first.trim(); body.last_name = last.trim(); }
      if (changedTheme) { body.theme = theme; }
      await api.updateMe(body);
      await refresh();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    // Revert any edits and close
    setFirst(initial.first);
    setLast(initial.last);
    setTheme(initial.theme);
    // Ensure preview reverts immediately
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initial.theme);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="frame bg-[var(--bg-1)] w-full max-w-xl h-96 grid grid-cols-[150px_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-r border-[var(--stroke)] p-4 text-sm">
          <div className="mb-2 font-medium">Settings</div>
          <ul className="space-y-1">
            <li>
              <button type="button"
                className={`w-full text-left px-1 py-1 rounded ${tab === 'account' ? 'bg-[var(--bg-2)]' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => setTab("account")}
              >
                Account
              </button>
            </li>
            <li>
              <button type="button"
                className={`w-full text-left px-1 py-1 rounded ${tab === 'general' ? 'bg-[var(--bg-2)]' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => setTab("general")}
              >
                General
              </button>
            </li>
          </ul>
        </div>
        <div className="p-4 text-sm flex flex-col">
          {tab === "account" ? (
            <>
              <div className="mb-3">
                <div className="text-base font-medium mb-2">Account</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1">First name</label>
                    <input className="input w-full" value={first} onChange={(e)=>setFirst(e.target.value)} />
                  </div>
                  <div>
                    <label className="block mb-1">Last name</label>
                    <input className="input w-full" value={last} onChange={(e)=>setLast(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block mb-1">Username <span className="opacity-60 text-xs">(not editable yet)</span></label>
                  <input
                    className="input w-full opacity-60 cursor-not-allowed"
                    value={(session?.user.email?.split('@')[0]) || (session?.user.display_name || '').replace(/\s+/g,'').toLowerCase()}
                    disabled
                    readOnly
                  />
                </div>
                {err && <div className="text-red-400 text-xs mt-2">{err}</div>}
              </div>

              <div className="mt-auto flex justify-end gap-2">
                <button className="button" onClick={onCancel} disabled={saving}>Cancel</button>
                <button className="button" onClick={onSave} disabled={!canSave}>{saving? 'Saving…' : 'Save'}</button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-base font-medium mb-2">Appearance</div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'nord', name: 'Nord', colors: { bg1: '#222227', bg2: '#2B2B31', accent: '#9F9FBF', highlight: '#7878A9' } },
                    { key: 'dust', name: 'Dust', colors: { bg1: '#272422', bg2: '#372E29', accent: '#CA8A67', highlight: '#996142' } },
                    { key: 'forest', name: 'Forest', colors: { bg1: '#222722', bg2: '#263526', accent: '#5AAB5A', highlight: '#317B31' } },
                    { key: 'sunset', name: 'Sunset', colors: { bg1: '#2B2523', bg2: '#3D2B27', accent: '#DD755B', highlight: '#C54626' } },
                  ] as const).map(t => (
                    <button type="button"
                      key={t.key}
                      onClick={() => setTheme(t.key)}
                      className={`frame p-2 text-left ${theme===t.key? 'border-[var(--accent)]' : ''}`}
                      aria-pressed={theme===t.key}
                    >
                      <div className="flex items-center gap-2">
                        <div className="grid grid-cols-4 gap-1">
                          <div className="w-6 h-6 rounded" style={{ background: t.colors.bg1 }} />
                          <div className="w-6 h-6 rounded" style={{ background: t.colors.bg2 }} />
                          <div className="w-6 h-6 rounded" style={{ background: t.colors.accent }} />
                          <div className="w-6 h-6 rounded" style={{ background: t.colors.highlight }} />
                        </div>
                        <div>{t.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto flex justify-end gap-2">
                <button type="button" className="button" onClick={onCancel} disabled={saving}>Cancel</button>
                <button type="button" className="button" onClick={onSave} disabled={!canSave}>{saving? 'Saving…' : 'Save'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
