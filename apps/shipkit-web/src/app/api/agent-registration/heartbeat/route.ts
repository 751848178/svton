import { agentRegistrationGateway } from '@/server/agent-registration-gateway';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handle = (request: Request) => agentRegistrationGateway(request, 'heartbeat');
export { handle as POST, handle as GET, handle as HEAD, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS };
