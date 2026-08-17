import React from 'react';
import { cn } from '@svton/ui';
import { SettingsSwitch } from './SettingsSwitch';

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <SettingsSwitch checked={checked} onCheckedChange={onChange} label={label} />;
}

export function Badge({ color, children }: { color: 'green' | 'blue' | 'yellow' | 'gray' | 'red'; children: React.ReactNode }) {
  const colors = { green: 'bg-green-900/40 text-green-400', blue: 'bg-blue-900/40 text-blue-400', yellow: 'bg-yellow-900/40 text-yellow-400', gray: 'bg-[#2a2a2a] text-gray-500', red: 'bg-red-900/40 text-red-400' };
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium', colors[color])}>{children}</span>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-[#383838] bg-[#2a2a2a] p-5', className)}>{children}</div>;
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-[11px] uppercase tracking-wider text-gray-500">{children}</label>;
}

export const INPUT_CLS = 'min-h-11 w-full rounded-lg border border-[#333] bg-[#222] px-3 py-2 text-sm text-gray-200 outline-none placeholder:text-gray-600 focus:border-cyan-600';
export const SELECT_CLS = 'min-h-11 w-full cursor-pointer rounded-lg border border-[#333] bg-[#222] px-3 text-sm text-gray-200 outline-none focus:border-cyan-600';
