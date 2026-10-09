'use client';
import { useRouter, useSearchParams } from 'next/navigation';

export type View = 'projects' | 'overview' | 'release' | 'history' | 'settings' | 'agents';
export type SettingsSection = 'connections' | 'repository' | 'variables';
export interface Location { view: View; projectId: string; taskId: string; step: number; section?: SettingsSection }
export function useNavigation() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('view');
  const view: View = raw && ['overview', 'release', 'history', 'settings', 'agents'].includes(raw) ? raw as View : 'projects';
  const location: Location = {
    view, projectId: view === 'agents' || view === 'projects' ? '' : params.get('project') || '', taskId: view === 'release' ? params.get('task') || '' : '',
    step: Math.min(4, Math.max(1, Number(params.get('step')) || 1)),
    section: view === 'settings' && ['repository', 'variables'].includes(params.get('section') || '') ? params.get('section') as SettingsSection : undefined,
  };
  const navigate = (next: Partial<Location>) => {
    const destination = { ...location, ...next };
    if (destination.view === 'agents' || destination.view === 'projects') destination.projectId = '';
    if (destination.view !== 'release') destination.taskId = '';
    const query = new URLSearchParams();
    if (destination.view !== 'projects') query.set('view', destination.view);
    if (destination.projectId) query.set('project', destination.projectId);
    if (destination.taskId) query.set('task', destination.taskId);
    if (destination.view === 'release') query.set('step', String(destination.step));
    if (destination.view === 'settings' && destination.section && destination.section !== 'connections') query.set('section', destination.section);
    router.push(`/${query.size ? `?${query}` : ''}`, { scroll: false });
  };
  return { location, navigate };
}
