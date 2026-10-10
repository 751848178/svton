import type { AgentHeartbeatReceipt, AgentSessionOpenReceipt, RegistrationStatus } from 'shipkit/platform';
import type { AgentSession, Prisma } from '../../generated/client/index.js';
import { registrationFault } from './fault.js';
import { loadRegistrationProtocol } from './protocol.js';

export async function nextRegistrationCounter(value: number): Promise<number> {
  const { REGISTRATION_COUNTER_MAX } = await loadRegistrationProtocol();
  if (!Number.isInteger(value) || value < 1 || value >= REGISTRATION_COUNTER_MAX) registrationFault('AGENT_COUNTER_EXHAUSTED');
  return value + 1;
}
export function assertSessionClock(session: AgentSession, now: Date): void {
  if (now < session.lastSeenAt) registrationFault('AGENT_CLOCK_INVALID');
}
export async function leaseDeadline(now: Date): Promise<Date> {
  const { REGISTRATION_LEASE_MS } = await loadRegistrationProtocol();
  const deadline = new Date(now.getTime() + REGISTRATION_LEASE_MS);
  if (!Number.isFinite(deadline.getTime())) registrationFault('AGENT_CLOCK_INVALID');
  return deadline;
}
export function sessionStatus(status: RegistrationStatus) {
  return { reportedRole: status.reportedRole, version: status.version, docker: status.docker,
    capabilitiesJson: JSON.stringify(status.capabilities) };
}
/** Every durable ledger field participates in the update fence. */
export function observedSession(session: AgentSession): Prisma.AgentSessionWhereInput {
  return { ...session };
}
export async function sessionOpenView(session: AgentSession): Promise<AgentSessionOpenReceipt> {
  const { REGISTRATION_HEARTBEAT_INTERVAL_MS } = await loadRegistrationProtocol();
  return { v: 1, epoch: session.epoch, lastSequence: session.lastSequence,
    leaseExpiresAt: session.leaseExpiresAt.toISOString(), heartbeatIntervalMs: REGISTRATION_HEARTBEAT_INTERVAL_MS };
}
export function heartbeatView(session: AgentSession): AgentHeartbeatReceipt {
  return { v: 1, epoch: session.epoch, sequence: session.lastSequence,
    acceptedAt: session.lastSeenAt.toISOString(), leaseExpiresAt: session.leaseExpiresAt.toISOString() };
}
/** Corrupt or expanded persisted receipts cannot become response data. */
export async function originalHeartbeatReceipt(session: AgentSession): Promise<AgentHeartbeatReceipt> {
  const { parseAgentHeartbeatReceipt } = await loadRegistrationProtocol();
  const expected = heartbeatView(session);
  try {
    const receipt = parseAgentHeartbeatReceipt(JSON.parse(session.lastReceiptJson!));
    if (Object.entries(expected).some(([key, value]) => receipt[key as keyof AgentHeartbeatReceipt] !== value)) {
      registrationFault('AGENT_SEQUENCE_CONFLICT');
    }
  } catch { registrationFault('AGENT_SEQUENCE_CONFLICT'); }
  return expected;
}
