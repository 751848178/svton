import { Injectable } from '@nestjs/common';
import type { ExecutorPort } from './executor.port.js';

@Injectable()
export class PlatformExecutorService implements ExecutorPort {
  private async executor(): Promise<ExecutorPort> {
    return await import('shipkit/platform') as unknown as ExecutorPort;
  }
  inspectProject: ExecutorPort['inspectProject'] = async (input, options) => (await this.executor()).inspectProject(input, options);
  resolveRepositorySource: ExecutorPort['resolveRepositorySource'] = async (source, options) => (await this.executor()).resolveRepositorySource(source, options);
  listProjectAgentConnections: ExecutorPort['listProjectAgentConnections'] = async (input) => (await this.executor()).listProjectAgentConnections(input);
  checkProjectAgentConnection: ExecutorPort['checkProjectAgentConnection'] = async (input, locator, endpoint) => (await this.executor()).checkProjectAgentConnection(input, locator, endpoint);
  diagnoseProject: ExecutorPort['diagnoseProject'] = async (input) => (await this.executor()).diagnoseProject(input);
  preparePlan: ExecutorPort['preparePlan'] = async (input, request, options) => (await this.executor()).preparePlan(input, request, options);
  executeTask: ExecutorPort['executeTask'] = async (input, plan, hooks) => (await this.executor()).executeTask(input, plan, hooks);
  reconcileTask: ExecutorPort['reconcileTask'] = async (input, jobs, hooks) => (await this.executor()).reconcileTask(input, jobs, hooks);
  archiveForCleanup: ExecutorPort['archiveForCleanup'] = async (input, refs, hooks, plan, expectedLeaseRef) => (await this.executor()).archiveForCleanup(input, refs, hooks, plan, expectedLeaseRef);
  retryCleanup: ExecutorPort['retryCleanup'] = async (input, plan, expectedLeaseRef) => (await this.executor()).retryCleanup(input, plan, expectedLeaseRef);
  fetchHistory: ExecutorPort['fetchHistory'] = async (input) => (await this.executor()).fetchHistory(input);
}
