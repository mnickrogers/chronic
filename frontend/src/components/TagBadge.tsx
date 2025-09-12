"use client";
export default function TagBadge({ name, color, onRemove, borderless }:{ name: string; color?: string | null; onRemove?: ()=>void; borderless?: boolean }){
  const bg = color || '#6B7280';
  const text = readableTextColor(bg);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm ${borderless? '':'border border-[var(--stroke)]'}`} style={{ backgroundColor: bg, color: text }}>
      <span className="text-xs">{name}</span>
      {onRemove && (
        <button className="text-xs opacity-80 hover:opacity-100" onClick={(e)=>{ e.stopPropagation(); onRemove(); }} title="Remove">×</button>
      )}
    </span>
  );
}

function readableTextColor(hex: string): string {
  try {
    const h = hex.replace('#','');
    const r = parseInt(h.length===3? h[0]+h[0]: h.slice(0,2), 16);
    const g = parseInt(h.length===3? h[1]+h[1]: h.slice(2,4), 16);
    const b = parseInt(h.length===3? h[2]+h[2]: h.slice(4,6), 16);
    const yiq = (r*299 + g*587 + b*114)/1000;
    return yiq >= 128 ? '#111827' : '#F9FAFB';
  } catch { return '#F9FAFB'; }
}
