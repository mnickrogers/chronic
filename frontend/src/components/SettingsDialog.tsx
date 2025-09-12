"use client";
import React from "react";

export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
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
            <li className="opacity-70">General</li>
          </ul>
        </div>
        <div className="p-4 text-sm">Coming soon…</div>
      </div>
    </div>
  );
}

