/**
 * 执行治理域 - Supervisor 快照类型入口
 * 单一职责：组合 Server 执行监控快照的顶层接口。
 */

import type { SupervisorAgentSnapshot } from './supervisor-agent.types';
import type { SupervisorExecutionAuditVisibility } from './supervisor-audit.types';
import type { SupervisorRemoteOrphanGovernancePreflight } from './supervisor-remote-orphan.types';
import type {
  SupervisorLeaseSnapshot,
  SupervisorQueueCoordinationPreflight,
  SupervisorQueueSnapshot,
  SupervisorWorkerInventorySnapshot,
  SupervisorWorkerOwnerSnapshot,
  SupervisorWorkerSnapshot,
} from './supervisor-worker.types';

export interface ServerExecutionSupervisorSnapshot {
  generatedAt: string;
  worker: SupervisorWorkerSnapshot;
  workerInventory: SupervisorWorkerInventorySnapshot;
  queueCoordinationPreflight: SupervisorQueueCoordinationPreflight;
  remoteOrphanGovernancePreflight: SupervisorRemoteOrphanGovernancePreflight;
  executionAuditVisibility: SupervisorExecutionAuditVisibility;
  queue: SupervisorQueueSnapshot;
  leases: SupervisorLeaseSnapshot;
  workers: SupervisorWorkerOwnerSnapshot[];
  agent: SupervisorAgentSnapshot;
}
