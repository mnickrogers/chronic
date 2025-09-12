"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";

type TabKey = "account" | "general";

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, refresh } = useSession();
  const [tab, setTab] = useState<TabKey>("account");
  const initial = {
    first: session?.user.first_name || "",
    last: session?.user.last_name || "",
  };

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset local state whenever dialog opens or session changes
  useEffect(() => {
    if (open) {
      setTab("account");
      setFirst(initial.first);
      setLast(initial.last);
      setSaving(false);
      setErr(null);
    }
  }, [open, initial.first, initial.last]);

  if (!open) return null;

  const changed = first !== (session?.user.first_name || "") || last !== (session?.user.last_name || "");
  const canSave = !saving && changed && (first.trim().length > 0);

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      await api.updateMe({ first_name: first.trim(), last_name: last.trim() });
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
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="frame bg-[#222227] w-full max-w-xl h-96 grid grid-cols-[150px_1fr]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-r border-[var(--stroke)] p-4 text-sm">
          <div className="mb-2 font-medium">Settings</div>
          <ul className="space-y-1">
            <li>
              <button
                className={`w-full text-left px-1 py-1 rounded ${tab === 'account' ? 'bg-[#2B2B31]' : 'opacity-70 hover:opacity-100'}`}
                onClick={() => setTab("account")}
              >
                Account
              </button>
            </li>
            <li>
              <button
                className={`w-full text-left px-1 py-1 rounded ${tab === 'general' ? 'bg-[#2B2B31]' : 'opacity-70 hover:opacity-100'}`}
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
            <div className="text-[0.95rem] opacity-80">Coming soon…</div>
          )}
        </div>
      </div>
    </div>
  );
}
