import { admitAgentRegistration } from './agent-registration-admission';
import { readAgentRegistrationBody } from './agent-registration-body';
import { AGENT_GATEWAY_DEADLINE_MS, type AgentRegistrationPhase } from './agent-registration-contracts';
import { AgentGatewayFault, gatewayFailure } from './agent-registration-fault';
import { AgentRegistrationGatewaySettings } from './agent-registration-settings';
import { forwardAgentRegistration } from './agent-registration-transport';

let configured: AgentRegistrationGatewaySettings | undefined;

/** The three exact App Routes share this admission and bounded forwarding lifecycle. */
export async function agentRegistrationGateway(request: Request, phase: AgentRegistrationPhase,
  settings?: AgentRegistrationGatewaySettings): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(new AgentGatewayFault('AGENT_GATEWAY_ABORTED'));
  const deadline = setTimeout(() => controller.abort(new AgentGatewayFault('AGENT_GATEWAY_DEADLINE')), AGENT_GATEWAY_DEADLINE_MS);
  request.signal.addEventListener('abort', abort, { once: true });
  try {
    if (request.signal.aborted) abort();
    if (controller.signal.aborted) throw controller.signal.reason;
    const context = settings ?? (configured ??= new AgentRegistrationGatewaySettings());
    const authorization = admitAgentRegistration(request, phase, context);
    const body = await readAgentRegistrationBody(request, controller.signal);
    return await forwardAgentRegistration(phase, body, authorization, context, controller.signal);
  } catch (error) { return gatewayFailure(controller.signal.aborted ? controller.signal.reason : error); }
  finally { clearTimeout(deadline); request.signal.removeEventListener('abort', abort); }
}
