// Job visibility follows the authenticated credential's effective builder/runtime role.
import type { AgentRole, Job } from '../shared/types.js';
export function jobRole(job: Job): 'builder' | 'runtime' | 'both' {
  if (job.type === 'verify') return 'both';
  return job.type === 'build' || job.type === 'push' ? 'builder' : 'runtime';
}
export function canReadJob(job: Job, role: AgentRole): boolean {
  const required = jobRole(job);
  return role === 'both' || required === 'both' || role === required;
}
