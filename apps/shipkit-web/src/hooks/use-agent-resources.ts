'use client';
import { useState } from 'react';
import type { AgentResource, AgentResourceChecks } from '@/lib/agent-contracts';
import { request } from '@/lib/api';
import { useApi } from './use-api';

export function useAgentResources() {
  const inventory = useApi('GET:/agents', {});
  const [results, setResults] = useState<Record<string, AgentResourceChecks>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, unknown>>({});
  const check = async (id: string) => {
    if (pending[id]) return;
    setPending(value => ({ ...value, [id]: true })); setErrors(value => ({ ...value, [id]: null }));
    try { const result = await request('POST:/agents/:id/checks', { id }); setResults(value => ({ ...value, [id]: result })); }
    catch (error) { setErrors(value => ({ ...value, [id]: error })); }
    finally { setPending(value => ({ ...value, [id]: false })); }
  };
  const resultFor = (resource: AgentResource) => {
    const result = results[resource.id];
    return result && result.checks.length === resource.bindings.length && resource.bindings.every(binding => result.checks.some(check => check.bindingId === binding.id)) ? result : undefined;
  };
  return { inventory, pending, errors, check, resultFor };
}
