import React from 'react';

export function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-[13px] rounded-md flex items-center gap-2.5 transition-colors ${
        active ? 'text-white bg-[#2a2a2a]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]/60'
      }`}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
