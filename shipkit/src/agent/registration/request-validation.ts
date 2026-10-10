import { parseAgentHeartbeatRequest, parseAgentSessionOpenRequest, parseEnrollmentConsumeRequest,
  parseEnrollmentSecret, parseMachineSecret } from '../../shared/registration-validation.js';
import { parseAgentHeartbeatReceipt, parseAgentSessionOpenReceipt, parseEnrollmentReceipt } from '../../shared/registration-receipts.js';
import { REGISTRATION_REQUEST_BYTES, REGISTRATION_REQUEST_DEADLINE_MS, REGISTRATION_REQUEST_MAX_DEADLINE_MS,
  type RegistrationRequest, type RegistrationReceipt } from './request-contracts.js';
import { RegistrationRequestError } from './request-errors.js';
import { registrationOrigin } from './config.js';

export function prepareRegistrationRequest(options: RegistrationRequest): { url: URL; body: Buffer; deadline: number; options: RegistrationRequest } {
  try {
    const serverOrigin = registrationOrigin(options.serverOrigin), caFile = options.caFile, signal = options.signal;
    const origin = new URL(serverOrigin);
    const inputDeadline = options.deadlineMs;
    const deadline = inputDeadline === undefined ? REGISTRATION_REQUEST_DEADLINE_MS : inputDeadline;
    if (!Number.isSafeInteger(deadline) || deadline < 1 || deadline > REGISTRATION_REQUEST_MAX_DEADLINE_MS) throw new Error();
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw new Error();
    const common = { serverOrigin, caFile, signal, deadlineMs: deadline };
    let normalized: RegistrationRequest;
    if (options.phase === 'enroll') normalized = { ...common, phase: 'enroll', credential: parseEnrollmentSecret(options.credential), dto: parseEnrollmentConsumeRequest(options.dto) };
    else if (options.phase === 'session') normalized = { ...common, phase: 'session', credential: parseMachineSecret(options.credential), dto: parseAgentSessionOpenRequest(options.dto) };
    else if (options.phase === 'heartbeat') normalized = { ...common, phase: 'heartbeat', credential: parseMachineSecret(options.credential), dto: parseAgentHeartbeatRequest(options.dto) };
    else throw new Error();
    const body = Buffer.from(JSON.stringify(normalized.dto));
    if (body.length > REGISTRATION_REQUEST_BYTES) throw new Error();
    return { url: new URL(`/api/agent-registration/${normalized.phase}`, origin), body, deadline, options: Object.freeze(normalized) };
  } catch { throw new RegistrationRequestError('REGISTRATION_REQUEST_INVALID'); }
}
export function parseRegistrationResponse(options: RegistrationRequest, input: unknown): RegistrationReceipt {
  try {
    if (options.phase === 'enroll') {
      const receipt = parseEnrollmentReceipt(input);
      if (receipt.incarnation !== options.dto.incarnation) throw new Error();
      return receipt;
    }
    if (options.phase === 'session') return parseAgentSessionOpenReceipt(input);
    const receipt = parseAgentHeartbeatReceipt(input);
    if (receipt.epoch !== options.dto.epoch || receipt.sequence !== options.dto.sequence) throw new Error();
    return receipt;
  } catch { throw new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID'); }
}
