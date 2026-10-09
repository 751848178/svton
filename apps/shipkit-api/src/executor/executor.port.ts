import type { ProjectInput, PlanRequest, ExecutionPlan, ExecutionHooks, ExecutionOutcome, RemoteJobRef, RepositorySource, RepositoryResolveOptions, SourceSnapshot, PrivatePlanOptions } from 'shipkit/platform';
export type { ProjectInput, PlanRequest, ExecutionPlan, ExecutionHooks, ExecutionEvent, RemoteJobRef } from 'shipkit/platform';
export interface ExecutorPort {
  listProjectAgentConnections(input: ProjectInput): Promise<import('shipkit/platform').ProjectAgentConnections>;
  checkProjectAgentConnection(input: ProjectInput, locator: string, expectedEndpoint?: string): Promise<import('shipkit/platform').AgentConnectionCheck>;
  inspectProject(input: ProjectInput, options?: PrivatePlanOptions): Promise<unknown>;
  resolveRepositorySource(source: RepositorySource, options?: RepositoryResolveOptions): Promise<SourceSnapshot>;
  diagnoseProject(input: ProjectInput): Promise<unknown>;
  preparePlan(input: ProjectInput, request: PlanRequest, options?: PrivatePlanOptions): Promise<ExecutionPlan>;
  executeTask(input: ProjectInput, plan: ExecutionPlan, hooks: ExecutionHooks): Promise<ExecutionOutcome>;
  reconcileTask(input: ProjectInput, remoteJobs: RemoteJobRef[], hooks: ExecutionHooks): Promise<ExecutionOutcome>;
  archiveForCleanup(input: ProjectInput, refs: RemoteJobRef[], hooks: ExecutionHooks, plan?: ExecutionPlan, expectedLeaseRef?: string): Promise<unknown>;
  retryCleanup(input: ProjectInput, plan?: ExecutionPlan, expectedLeaseRef?: string): Promise<unknown>;
  fetchHistory(input: ProjectInput): Promise<unknown>;
}
