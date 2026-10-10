import { request as httpsRequest } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { AgentHeartbeatReceipt, AgentSessionOpenReceipt, EnrollmentReceipt } from '../../shared/registration-contracts.js';
import { REGISTRATION_RESPONSE_BYTES, REGISTRATION_RESPONSE_HEADER_BYTES, type RegistrationRequest, type RegistrationReceipt,
  type EnrollmentRegistrationRequest, type SessionRegistrationRequest, type HeartbeatRegistrationRequest } from './request-contracts.js';
import { RegistrationRequestError, registrationHttpError, registrationNetworkError } from './request-errors.js';
import { loadRegistrationCa } from './request-ca.js';
import { parseRegistrationResponse, prepareRegistrationRequest } from './request-validation.js';

export function requestRegistration(options: EnrollmentRegistrationRequest): Promise<EnrollmentReceipt>;
export function requestRegistration(options: SessionRegistrationRequest): Promise<AgentSessionOpenReceipt>;
export function requestRegistration(options: HeartbeatRegistrationRequest): Promise<AgentHeartbeatReceipt>;
export function requestRegistration(options: RegistrationRequest): Promise<RegistrationReceipt>;
export async function requestRegistration(options: RegistrationRequest): Promise<RegistrationReceipt> {
  const prepared = prepareRegistrationRequest(options);
  // Freeze correlation and authentication inputs before the first await.
  options = prepared.options;
  return new Promise((resolve, reject) => {
    let request: ClientRequest | undefined, response: IncomingMessage | undefined, settled = false;
    const controller = new AbortController();
    const finish = (error?: RegistrationRequestError, receipt?: RegistrationReceipt): void => {
      if (settled) return;
      settled = true; clearTimeout(timer); options.signal?.removeEventListener('abort', aborted);
      controller.abort(); response?.destroy(); request?.destroy();
      if (error) reject(error); else resolve(receipt!);
    };
    const aborted = (): void => finish(new RegistrationRequestError('REGISTRATION_REQUEST_ABORTED'));
    const timer = setTimeout(() => finish(new RegistrationRequestError('REGISTRATION_REQUEST_TIMEOUT')), prepared.deadline);
    options.signal?.addEventListener('abort', aborted, { once: true });
    if (options.signal?.aborted) { aborted(); return; }
    const receive = (incoming: IncomingMessage): void => {
      if (settled) { incoming.destroy(); return; }
      response = incoming;
      const status = incoming.statusCode ?? 0;
      if (status >= 300 && status <= 399) { finish(new RegistrationRequestError('REGISTRATION_REDIRECT_REJECTED', status)); return; }
      const chunks: Buffer[] = []; let bytes = 0;
      incoming.on('data', (chunk: Buffer) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > REGISTRATION_RESPONSE_BYTES) { finish(new RegistrationRequestError('REGISTRATION_RESPONSE_LIMIT', status)); return; }
        chunks.push(chunk);
      });
      incoming.on('error', () => finish(new RegistrationRequestError('REGISTRATION_CONNECTION_FAILED')));
      incoming.on('aborted', () => finish(new RegistrationRequestError('REGISTRATION_CONNECTION_FAILED')));
      incoming.on('end', () => {
        if (settled) return;
        let value: unknown;
        try {
          if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(incoming.headers['content-type'] ?? '')) throw new Error();
          value = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'));
        } catch {
          finish(status === 200 || status === 201 ? new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID') : registrationHttpError(status, undefined));
          return;
        }
        if (status !== 200 && status !== 201) { finish(registrationHttpError(status, value)); return; }
        try { finish(undefined, parseRegistrationResponse(options, value)); }
        catch { finish(new RegistrationRequestError('REGISTRATION_RESPONSE_INVALID')); }
      });
    };
    void (async () => {
      try {
        const ca = options.caFile === undefined ? undefined : await loadRegistrationCa(options.caFile, controller.signal);
        if (settled) return;
        request = httpsRequest(prepared.url, { method: 'POST', agent: false, maxHeaderSize: REGISTRATION_RESPONSE_HEADER_BYTES, ...(ca ? { ca } : {}),
          rejectUnauthorized: true, headers: { authorization: `Bearer ${options.credential}`, 'content-type': 'application/json',
            accept: 'application/json', 'content-length': String(prepared.body.length) } }, receive);
        request.on('error', error => finish(registrationNetworkError(error)));
        request.end(prepared.body);
      } catch (error) { finish(error instanceof RegistrationRequestError ? error : registrationNetworkError(error)); }
    })();
  });
}
