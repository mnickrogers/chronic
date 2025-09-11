"use client";

export default function UserBadge({ name, email, size=22 }:{ name?: string; email?: string; size?: number }){
  const label = (name || email || '?').trim();
  const initials = label.split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('') || '?';
  const style = { width: size, height: size, lineHeight: `${size-2}px` } as const;
  return (
    <div className="rounded-full bg-[#3A3A45] text-[10px] text-center" style={style} title={label}>
      {initials}
    </div>
  );
}

