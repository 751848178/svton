import type { ProjectInput, PlanRequest, ExecutionPlan, ExecutionHooks, ExecutionOutcome, RemoteJobRef } from 'shipkit/platform';
export type { ProjectInput, PlanRequest, ExecutionPlan, ExecutionHooks, ExecutionEvent, RemoteJobRef } from 'shipkit/platform';
export interface ExecutorPort {
  listProjectAgentConnections(input: ProjectInput): Promise<import('shipkit/platform').ProjectAgentConnections>;
  checkProjectAgentConnection(input: ProjectInput, locator: string, expectedEndpoint?: string): Promise<import('shipkit/platform').AgentConnectionCheck>;
  inspectProject(input: ProjectInput): Promise<unknown>;
  diagnoseProject(input: ProjectInput): Promise<unknown>;
  preparePlan(input: ProjectInput, request: PlanRequest): Promise<ExecutionPlan>;
  executeTask(input: ProjectInput, plan: ExecutionPlan, hooks: ExecutionHooks): Promise<ExecutionOutcome>;
  reconcileTask(input: ProjectInput, remoteJobs: RemoteJobRef[], hooks: ExecutionHooks): Promise<ExecutionOutcome>;
  archiveForCleanup(input: ProjectInput, refs: RemoteJobRef[], hooks: ExecutionHooks, plan?: ExecutionPlan, expectedLeaseRef?: string): Promise<unknown>;
  retryCleanup(input: ProjectInput, plan?: ExecutionPlan, expectedLeaseRef?: string): Promise<unknown>;
  fetchHistory(input: ProjectInput): Promise<unknown>;
}
