import { AGENT_GATEWAY_BODY_BYTES } from './agent-registration-contracts';
import { AgentGatewayFault } from './agent-registration-fault';

/** Bound the actual streamed bytes even when content-length is absent or false. */
export async function readAgentRegistrationBody(request: Request, signal: AbortSignal): Promise<Buffer> {
  if (!request.body) throw new AgentGatewayFault('AGENT_GATEWAY_BODY_INVALID');
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  let bytes = 0;
  signal.addEventListener('abort', cancel, { once: true });
  try {
    if (signal.aborted) { cancel(); throw signal.reason; }
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > AGENT_GATEWAY_BODY_BYTES) { cancel(); throw new AgentGatewayFault('AGENT_GATEWAY_BODY_LIMIT'); }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks, bytes);
    try {
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    } catch { throw new AgentGatewayFault('AGENT_GATEWAY_BODY_INVALID'); }
    return body;
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}
