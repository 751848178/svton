'use client';

import React, { useState } from 'react';

// ── Section (collapsible card) ─────────────────────────────

export function Section({ title, icon, children, defaultOpen = false, rightSlot }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium text-gray-200">{title}</span>
        </div>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {rightSlot}
          <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor"
            className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="M3 5l3 3 3-3H3z" />
          </svg>
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-[#2a2a2a]">{children}</div>}
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────

export function Badge({ color, children }: { color: 'green' | 'blue' | 'yellow' | 'gray' | 'red'; children: React.ReactNode }) {
  const colors = {
    green: 'bg-green-900/40 text-green-400',
    blue: 'bg-blue-900/40 text-blue-400',
    yellow: 'bg-yellow-900/40 text-yellow-400',
    gray: 'bg-[#2a2a2a] text-gray-500',
    red: 'bg-red-900/40 text-red-400',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${colors[color]}`}>{children}</span>;
}

// ── Toggle switch ──────────────────────────────────────────

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-cyan-600' : 'bg-[#333]'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ── StatCard ───────────────────────────────────────────────

export function StatCard({ label, value, color, isText }: {
  label: string; value: number | string; color: 'green' | 'blue' | 'yellow' | 'gray'; isText?: boolean;
}) {
  const texts = { green: 'text-green-400', blue: 'text-blue-400', yellow: 'text-yellow-400', gray: 'text-gray-500' };
  return (
    <div className="bg-[#1c1c1c] rounded-xl border border-[#2a2a2a] p-3 text-center">
      <div className={`text-lg font-bold ${texts[color]} ${isText ? 'text-sm' : ''}`}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
