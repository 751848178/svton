import { request as httpRequest } from 'node:http';
import { AGENT_GATEWAY_RESPONSE_BYTES, agentRegistrationPath, type AgentRegistrationPhase } from './agent-registration-contracts';
import { AgentGatewayFault } from './agent-registration-fault';
import { agentRegistrationResponse } from './agent-registration-response';
import type { AgentRegistrationGatewaySettings } from './agent-registration-settings';

/** One exact loopback request; no environment proxy, DNS lookup, redirect or untrusted headers. */
export function forwardAgentRegistration(phase: AgentRegistrationPhase, body: Buffer, authorization: string,
  settings: AgentRegistrationGatewaySettings, signal: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', abort);
      reject(error instanceof AgentGatewayFault ? error : new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM'));
    };
    const request = httpRequest({ hostname: '127.0.0.1', port: settings.apiPort, method: 'POST',
      path: agentRegistrationPath(phase), headers: settings.upstreamHeaders(authorization, body.byteLength), agent: false }, response => {
      const chunks: Buffer[] = []; let bytes = 0;
      if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(response.headers['content-type'] ?? '')
        || response.headers['content-encoding'] !== undefined || response.headers['set-cookie'] !== undefined
        || Number(response.headers['content-length'] ?? '0') > AGENT_GATEWAY_RESPONSE_BYTES) {
        response.destroy(); request.destroy(); fail(new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM')); return;
      }
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.byteLength;
        if (bytes > AGENT_GATEWAY_RESPONSE_BYTES) { response.destroy(); request.destroy(); fail(new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM')); }
        else chunks.push(chunk);
      });
      response.on('error', fail); response.on('aborted', () => fail(new AgentGatewayFault('AGENT_GATEWAY_UPSTREAM')));
      response.on('end', () => {
        if (settled) return;
        if (signal.aborted) { fail(signal.reason); return; }
        try {
          const result = agentRegistrationResponse(response.statusCode ?? 0, Buffer.concat(chunks, bytes));
          settled = true; signal.removeEventListener('abort', abort); resolve(result);
        } catch (error) { fail(error); }
      });
    });
    const abort = () => { request.destroy(); fail(signal.reason); };
    request.on('error', fail); signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else request.end(body);
  });
}
