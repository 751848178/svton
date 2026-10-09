'use client';
import { useEffect, useState } from 'react';
import type { LiveProject, Plan, Project, TaskDetail } from '@/lib/contracts';
import type { Location } from './use-navigation';
import { request } from '@/lib/api';
import { isBusy, requiresCleanup } from '@/lib/presentation';

interface Input { project: Project; live: LiveProject; location: Location; detail?: TaskDetail; navigate: (next: Partial<Location>) => void; refresh: () => void }
export function useRelease(input: Input) {
  const { project, live, location, detail, navigate, refresh } = input;
  const gitAvailable = !!live.source.repo && !!live.source.commit;
  const [selected, setSelected] = useState<string[]>(live.services.map(service => service.serviceKey));
  const [sourceMode, setSourceMode] = useState<'git' | 'directory'>(gitAvailable ? 'git' : 'directory');
  const [keepEnv, setKeepEnv] = useState(false);
  const [keepBuilder, setKeepBuilder] = useState(false);
  const [version, setVersion] = useState(project.nextVersion || '0.0.1');
  const [versionEdited, setVersionEdited] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const task = detail?.task;
  const readOnly = !!location.taskId;
  useEffect(() => {
    if (detail?.plan) {
      setPlan(detail.plan); setSelected(detail.plan.selection); setSourceMode(detail.plan.sourceMode || (gitAvailable ? 'git' : 'directory'));
      setKeepEnv(detail.plan.keepEnv === true); setKeepBuilder(detail.plan.keepBuilder === true);
      setVersion(detail.plan.version || detail.task.version);
    }
  }, [detail?.plan?.id]);
  useEffect(() => {
    if (!readOnly && !plan && !versionEdited) setVersion(project.nextVersion || '0.0.1');
  }, [project.nextVersion, readOnly, plan, versionEdited]);
  useEffect(() => { if (!gitAvailable && !plan && !detail?.plan) setSourceMode('directory'); }, [gitAvailable, plan, detail?.plan]);
  const invalidate = () => { setPlan(null); setError(null); };
  const toggle = (service: string) => {
    if (readOnly) return;
    invalidate(); setSelected(value => value.includes(service) ? value.filter(item => item !== service) : [...value, service]);
  };
  const run = async (name: string, operation: () => Promise<void>) => {
    setAction(name); setError(null);
    try { await operation(); } catch (failure) { setError(failure); } finally { setAction(null); }
  };
  const prepare = () => request('POST:/projects/:id/plans', {
    id: project.id, kind: 'release', services: selected, sourceMode, keepEnv, keepBuilder, version,
  });
  const generatePlan = () => run('plan', async () => {
    if (readOnly) return;
    const next = await prepare(); setPlan(next); navigate({ step: 2, taskId: '' });
  });
  const start = () => run('start', async () => {
    if (readOnly) return;
    const next = plan;
    if (!next) throw new Error('请先生成并核对发布计划。');
    const created = await request('POST:/projects/:id/tasks', { id: project.id, planId: next.id, idempotencyKey: crypto.randomUUID() });
    setPlan(next); navigate({ view: 'release', taskId: created.id, step: 3 }); refresh();
  });
  const cancel = () => run('cancel', async () => {
    if (!task) return;
    await request('POST:/tasks/:id/cancel', { id: task.id }); refresh();
  });
  const cleanup = () => run('cleanup', async () => {
    if (!task) return;
    await request('POST:/tasks/:id/cleanup', { id: task.id }); refresh();
  });
  const busy = isBusy(task) || action !== null;
  const cleanupBlocked = requiresCleanup(task);
  const step = !task && location.step > 1 && !plan ? 1 : location.step;
  return {
    selected, sourceMode, gitAvailable, keepEnv, keepBuilder, version, plan, task, action, error, busy, cleanupBlocked, step, readOnly,
    toggle, generatePlan, start, cancel, cleanup,
    setSourceMode: (value: 'git' | 'directory') => { if (!readOnly) { invalidate(); setSourceMode(value); } },
    setKeepEnv: (value: boolean) => { if (!readOnly) { invalidate(); setKeepEnv(value); } },
    setKeepBuilder: (value: boolean) => { if (!readOnly) { invalidate(); setKeepBuilder(value); } },
    setVersion: (value: string) => { if (!readOnly) { invalidate(); setVersionEdited(true); setVersion(value); } },
  };
}
export type ReleaseController = ReturnType<typeof useRelease>;
