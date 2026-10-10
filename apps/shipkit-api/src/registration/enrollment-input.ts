import type { AgentRole } from 'shipkit/platform';
import { registrationFault } from './fault.js';

export interface EnrollmentIssueInput { name: string; approvedRole: AgentRole; resourceKind: 'persistent'; ttlSeconds: number }
export function enrollmentIssueInput(body: unknown): EnrollmentIssueInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) registrationFault('REGISTRATION_INPUT_INVALID');
  const value = body as Record<string, unknown>;
  const allowed = new Set(['v', 'name', 'approvedRole', 'resourceKind', 'ttlSeconds']);
  if (Object.keys(value).some(key => !allowed.has(key)) || value.v !== 1) registrationFault('REGISTRATION_INPUT_INVALID');
  if (value.resourceKind === 'temporary') registrationFault('TEMPORARY_AGENT_ENROLLMENT_UNSUPPORTED');
  if (value.resourceKind !== 'persistent' || typeof value.name !== 'string' || value.name.trim() !== value.name
    || !value.name.length || value.name.length > 128 || /[\u0000-\u001f\u007f]/.test(value.name)
    || typeof value.approvedRole !== 'string' || !['runtime', 'builder', 'both'].includes(value.approvedRole)) registrationFault('REGISTRATION_INPUT_INVALID');
  const ttlSeconds = value.ttlSeconds === undefined ? 900 : value.ttlSeconds;
  if (typeof ttlSeconds !== 'number' || !Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 900) {
    registrationFault('REGISTRATION_INPUT_INVALID');
  }
  return { name: value.name, approvedRole: value.approvedRole as AgentRole, resourceKind: 'persistent', ttlSeconds };
}
