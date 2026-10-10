import { isIP } from 'node:net';
import { AGENT_API_PROOF_HEADER, AGENT_EDGE_PROOF_HEADER, AGENT_GATEWAY_BODY_BYTES,
  agentRegistrationPath, type AgentRegistrationPhase } from './agent-registration-contracts';
import { AgentGatewayFault } from './agent-registration-fault';
import { canonicalGatewayProof } from './agent-registration-proof';
import type { AgentRegistrationGatewaySettings } from './agent-registration-settings';

const rejected = () => { throw new AgentGatewayFault('AGENT_GATEWAY_REJECTED'); };
const forwarded = ['x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port', 'x-forwarded-for'];

/** Standard Next loses some raw duplicate headers; trusted edge must reject those before proof injection. */
export function admitAgentRegistration(request: Request, phase: AgentRegistrationPhase, settings: AgentRegistrationGatewaySettings): string {
  if (!settings.enabled) throw new AgentGatewayFault('AGENT_GATEWAY_DISABLED');
  if (request.method !== 'POST') throw new AgentGatewayFault('AGENT_GATEWAY_METHOD');
  const url = new URL(request.url), headers = request.headers;
  if (url.pathname !== agentRegistrationPath(phase) || url.search || url.hash) rejected();
  if (headers.has('cookie') || headers.has('forwarded') || headers.has(AGENT_API_PROOF_HEADER)
    || headers.has('content-encoding') || headers.has('x-shipkit-local')) rejected();
  for (const [name, value] of headers) {
    if ((name.startsWith('x-forwarded-') && !forwarded.includes(name))
      || (name.startsWith('x-shipkit-') && name !== AGENT_EDGE_PROOF_HEADER)) rejected();
    if ((forwarded.includes(name) || ['host', 'origin', 'authorization', 'content-type', AGENT_EDGE_PROOF_HEADER].includes(name))
      && value.includes(',')) rejected();
  }
  settings.assertEdgeProof(headers.get(AGENT_EDGE_PROOF_HEADER));
  if (headers.get('host') !== settings.originHost || headers.get('x-forwarded-proto') !== 'https'
    || headers.get('x-forwarded-host') !== settings.originHost || headers.get('x-forwarded-port') !== settings.originPort) rejected();
  const peer = headers.get('x-forwarded-for');
  if (peer !== null && !isIP(peer)) rejected();
  if (headers.has('origin') && headers.get('origin') !== settings.origin) rejected();
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(headers.get('content-type') ?? '')) rejected();
  const length = headers.get('content-length');
  if (length !== null) {
    if (!/^(0|[1-9][0-9]*)$/.test(length)) rejected();
    if (Number(length) > AGENT_GATEWAY_BODY_BYTES) throw new AgentGatewayFault('AGENT_GATEWAY_BODY_LIMIT');
  }
  const authorization = headers.get('authorization') ?? '';
  const prefix = phase === 'enroll' ? 'ska_enroll_' : 'ska_machine_';
  if (!authorization.startsWith(`Bearer ${prefix}`) || !canonicalGatewayProof(authorization.slice(7 + prefix.length))) rejected();
  return authorization;
}
