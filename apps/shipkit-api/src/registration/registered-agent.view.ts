import type { AgentRole, RegistrationStatus } from 'shipkit/platform';
import type { DirectoryAgent } from './registered-agent.select.js';
import { loadRegistrationProtocol } from './protocol.js';

type Role = 'builder' | 'runtime';
export type AgentPresence = 'registered' | 'online' | 'suspect' | 'offline' | 'disabled' | 'revoked';
const roles = (role: string): Role[] => role === 'both' ? ['builder', 'runtime'] : role === 'builder' ? ['builder'] : role === 'runtime' ? ['runtime'] : [];
const purpose = (role: string) => role === 'both' ? '构建与运行机器' : role === 'builder' ? '构建机器' : '运行时机器';

async function metadata(agent: DirectoryAgent): Promise<RegistrationStatus | null> {
  if (!agent.session) return null;
  try {
    const { parseRegistrationStatus } = await loadRegistrationProtocol();
    const session = agent.session;
    return parseRegistrationStatus({ reportedRole: session.reportedRole, version: session.version,
      docker: session.docker, capabilities: JSON.parse(session.capabilitiesJson) });
  } catch { return null; }
}

export async function registeredAgentView(agent: DirectoryAgent, now: Date) {
  const protocol = await loadRegistrationProtocol(), session = agent.session, status = await metadata(agent);
  let presence: AgentPresence = 'registered';
  const reasons: string[] = [];
  if (agent.actor.disabled) { presence = 'revoked'; reasons.push('agent-revoked'); }
  else if (agent.actor.kind !== 'machine' || agent.resourceKind !== 'persistent') { presence = 'offline'; reasons.push('registered-identity-invalid'); }
  else if (agent.disabled) { presence = 'disabled'; reasons.push('agent-disabled'); }
  else if (session) {
    const age = now.getTime() - session.lastSeenAt.getTime();
    if (!Number.isFinite(age) || age < 0) { presence = 'offline'; reasons.push('server-clock-invalid'); }
    else if (session.incarnation !== agent.incarnation || session.credentialRevision !== agent.credentialRevision
      || session.trustRevision !== agent.trustRevision) { presence = 'offline'; reasons.push('session-fenced'); }
    else if (!Number.isFinite(session.leaseExpiresAt.getTime()) || session.leaseExpiresAt <= now
      || age >= protocol.REGISTRATION_LEASE_MS) { presence = 'offline'; reasons.push('session-lease-expired'); }
    else presence = age >= protocol.REGISTRATION_SUSPECT_AFTER_MS ? 'suspect' : 'online';
  } else reasons.push('session-not-open');
  const approvedRoles = roles(agent.approvedRole), reportedRoles = roles(status?.reportedRole ?? '');
  const effectiveRoles = approvedRoles.filter(role => status?.docker && reportedRoles.includes(role) && status.capabilities.includes(role));
  const roleReady = approvedRoles.length > 0 && effectiveRoles.length === approvedRoles.length;
  if (!status && session) reasons.push('reported-metadata-invalid');
  if (!roleReady) reasons.push('approved-role-capability-unavailable');
  if (agent.draining) reasons.push('agent-draining');
  reasons.push('registration-transport-not-connected');
  return { v: 1 as const, id: agent.id, name: agent.name, workspaceId: agent.workspaceId,
    source: 'registration-center' as const, resourceKind: agent.resourceKind as 'persistent',
    approvedRole: agent.approvedRole as AgentRole, purpose: purpose(agent.approvedRole),
    credentialRevision: agent.credentialRevision, trustRevision: agent.trustRevision,
    disabled: agent.disabled, draining: agent.draining, revoked: agent.actor.disabled, presence,
    reportedRole: status?.reportedRole ?? null, capabilities: status?.capabilities ?? [],
    version: status?.version ?? null, docker: status?.docker ?? false, effectiveRoles, roleReady,
    lastSeenAt: session?.lastSeenAt.toISOString() ?? null, leaseExpiresAt: session?.leaseExpiresAt.toISOString() ?? null,
    heartbeatIntervalMs: protocol.REGISTRATION_HEARTBEAT_INTERVAL_MS,
    suspectAfterMs: protocol.REGISTRATION_SUSPECT_AFTER_MS, leaseDurationMs: protocol.REGISTRATION_LEASE_MS,
    transportReady: false, executionReady: false, readinessReasons: reasons };
}
