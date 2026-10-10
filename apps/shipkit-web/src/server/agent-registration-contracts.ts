export type AgentRegistrationPhase = 'enroll' | 'session' | 'heartbeat';
export const agentRegistrationPath = (phase: AgentRegistrationPhase) => `/api/agent-registration/${phase}`;
export const AGENT_EDGE_PROOF_HEADER = 'x-shipkit-agent-edge';
export const AGENT_API_PROOF_HEADER = 'x-shipkit-agent-ingress';
export const AGENT_GATEWAY_BODY_BYTES = 8192;
export const AGENT_GATEWAY_RESPONSE_BYTES = 16384;
export const AGENT_GATEWAY_DEADLINE_MS = 5000;
