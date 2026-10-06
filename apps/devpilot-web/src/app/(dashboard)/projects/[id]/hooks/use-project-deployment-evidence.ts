'use client';

import { useEffect, useRef, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { DeploymentRun } from '../types/operations';
import { loadProjectDeploymentEvidence } from '../components/project-deployment-evidence.loader';
import { deploymentRunNeedsPolling } from '../components/project-deployment-evidence.model';

export function useProjectDeploymentEvidence(
  projectId: string,
  runId: string | null,
  initialRun: DeploymentRun | null,
) {
  const latestRunId = useRef(runId);
  const [run, setRun] = useState(initialRun);
  const [streams, setStreams] = useState<Awaited<ReturnType<typeof loadProjectDeploymentEvidence>>['streams']>([]);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof loadProjectDeploymentEvidence>>['entries']>([]);
  const [audits, setAudits] = useState<Awaited<ReturnType<typeof loadProjectDeploymentEvidence>>['audits']>([]);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState('');
  const [logsError, setLogsError] = useState('');
  const [auditError, setAuditError] = useState('');

  const load = usePersistFn(async () => {
    if (!runId) return;
    const targetId = runId;
    setLoading(true);
    try {
      const next = await loadProjectDeploymentEvidence({ projectId, runId: targetId, request: apiRequest });
      if (latestRunId.current !== targetId) return;
      setRun(next.run);
      setStreams(next.streams); setEntries(next.entries); setAudits(next.audits);
      setLogsError(next.logsError); setAuditError(next.auditError);
      setError('');
    } catch (cause) {
      if (latestRunId.current === targetId) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (latestRunId.current === targetId) setLoading(false);
    }
  });

  useEffect(() => {
    latestRunId.current = runId;
    if (!runId) return;
    setRun(initialRun);
    setStreams([]); setEntries([]); setAudits([]);
    setError(''); setLogsError(''); setAuditError('');
    void load();
  }, [initialRun, load, runId]);

  useEffect(() => {
    if (!runId || !deploymentRunNeedsPolling(run?.status ?? initialRun?.status)) return;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [initialRun?.status, load, run?.status, runId]);

  return { run, streams, entries, audits, loading, error, logsError, auditError, reload: load };
}
