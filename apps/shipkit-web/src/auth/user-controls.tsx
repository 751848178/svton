'use client';
import { LogOut, UserRound } from 'lucide-react';
import type { AuthenticatedProps } from './contracts';

export function UserControls({ user, onLogout }: AuthenticatedProps) {
  return <div className="user-controls"><span className="server-avatar"><UserRound size={18} aria-hidden="true" /></span>
    <div className="user-identity"><strong title={user.displayName}>{user.displayName || user.username}</strong><span title={user.username}>{user.username}</span></div>
    <button className="user-logout" onClick={onLogout} aria-label="退出登录" title="退出登录"><LogOut size={18} aria-hidden="true" /><span>退出</span></button>
  </div>;
}
