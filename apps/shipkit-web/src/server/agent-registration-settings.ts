import { createHash, timingSafeEqual } from 'node:crypto';
import { AGENT_API_PROOF_HEADER } from './agent-registration-contracts';
import { AgentGatewayFault } from './agent-registration-fault';
import { canonicalGatewayProof, readAgentGatewayProof } from './agent-registration-proof';

const proofHash = (value: string) => createHash('sha256').update('shipkit:agent-edge:v1\0').update(value).digest();

/** Deployment configuration and the two independent private hop proofs. */
export class AgentRegistrationGatewaySettings {
  readonly enabled: boolean;
  readonly apiPort: number;
  readonly origin?: string;
  readonly originHost?: string;
  readonly originPort?: string;
  readonly #edgeHash?: Buffer;
  readonly #apiProof?: string;
  constructor(env: Record<string, string | undefined> = process.env) {
    const mode = env.SHIPKIT_AGENT_GATEWAY_MODE ?? 'disabled';
    if (!['disabled', 'trusted-edge'].includes(mode)) throw new AgentGatewayFault('AGENT_GATEWAY_CONFIGURATION');
    this.enabled = mode === 'trusted-edge';
    this.apiPort = Number(env.SHIPKIT_API_PORT ?? '8770');
    if (!Number.isInteger(this.apiPort) || this.apiPort < 1 || this.apiPort > 65535) throw new AgentGatewayFault('AGENT_GATEWAY_CONFIGURATION');
    if (!this.enabled) return;
    try {
      const value = env.SHIPKIT_AGENT_PUBLIC_ORIGIN;
      if (!value) throw new Error();
      const origin = new URL(value);
      if (origin.protocol !== 'https:' || origin.origin !== value || origin.username || origin.password) throw new Error();
      this.origin = origin.origin; this.originHost = origin.host; this.originPort = origin.port || '443';
      const edge = readAgentGatewayProof(env.SHIPKIT_AGENT_EDGE_PROOF_FILE);
      const api = readAgentGatewayProof(env.SHIPKIT_AGENT_INGRESS_PROOF_FILE);
      if (edge === api) throw new Error();
      this.#edgeHash = proofHash(edge); this.#apiProof = api;
    } catch { throw new AgentGatewayFault('AGENT_GATEWAY_CONFIGURATION'); }
  }
  assertEdgeProof(value: string | null): void {
    if (!this.enabled) throw new AgentGatewayFault('AGENT_GATEWAY_DISABLED');
    if (!value || !canonicalGatewayProof(value) || !this.#edgeHash || !timingSafeEqual(this.#edgeHash, proofHash(value))) {
      throw new AgentGatewayFault('AGENT_GATEWAY_REJECTED');
    }
  }
  upstreamHeaders(authorization: string, bytes: number): Record<string, string> {
    if (!this.enabled || !this.#apiProof || !this.origin) throw new AgentGatewayFault('AGENT_GATEWAY_DISABLED');
    return { host: `127.0.0.1:${this.apiPort}`, authorization, 'content-type': 'application/json',
      'content-length': String(bytes), [AGENT_API_PROOF_HEADER]: this.#apiProof,
      origin: this.origin, 'x-forwarded-proto': 'https', 'x-forwarded-host': this.originHost!, 'x-forwarded-port': this.originPort! };
  }
}
