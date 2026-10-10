import { AgentGatewayFault } from './agent-registration-fault';

const registrationStatus: Record<string, number> = {
  REGISTRATION_INPUT_INVALID: 400, TEMPORARY_AGENT_ENROLLMENT_UNSUPPORTED: 400, REGISTRATION_UNAUTHORIZED: 401,
  REGISTRATION_EXPIRED: 410, REGISTRATION_CONFLICT: 409, AGENT_NOT_FOUND: 404, AGENT_SESSION_CONFLICT: 409,
  AGENT_SEQUENCE_CONFLICT: 409, AGENT_SESSION_EXPIRED: 409, AGENT_COUNTER_EXHAUSTED: 409,
  AGENT_CLOCK_INVALID: 409, AGENT_STATE_CONFLICT: 409, REGISTRATION_BUSY: 503,
};

/** Pass bounded success JSON; only closed error codes, never upstream message/log/header data. */
export function agentRegistrationResponse(status: number, body: Buffer): Response {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); }
  catch { throw new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM');
  if (status === 200 || status === 201) return Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
  const code = (value as { code?: unknown }).code;
  const numeric = [400, 401, 403, 404, 409, 410, 413, 429, 500, 503];
  if (typeof code !== 'string' || !(Object.hasOwn(registrationStatus, code) && registrationStatus[code] === status
    || numeric.includes(status) && code === String(status))) throw new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM');
  return Response.json({ code, message: '机器登记请求未能完成，请核对状态后保留原请求重试' }, {
    status, headers: { 'cache-control': 'no-store' },
  });
}
