import type {
  SupervisorBlockedJobSample,
  SupervisorBlockedReason,
  SupervisorBlocker,
  SupervisorNextStep,
  SupervisorQueuedJobSample,
} from './supervisor-common.types';

export interface SupervisorAgentLifecyclePreflight {
  state: 'ready' | 'degraded' | 'blocked' | 'disabled' | string;
  reason: string;
  gates: {
    targetSelection: {
      ready: boolean;
      enabled: boolean;
      capableServers: number;
      onlineCapableServers: number;
      reason: string;
    };
    heartbeat: {
      ready: boolean;
      enabled: boolean;
      tokenConfigured: boolean;
      requiredForTargetSelection: boolean;
      heartbeatServers: number;
      readyServers: number;
      issueServers: number;
      missingHeartbeatServers: number;
      reason: string;
    };
    dispatcher: {
      ready: boolean;
      executorEnabled: boolean;
      dispatcherConfigured: boolean;
      tokenConfigured: boolean;
      liveDispatchReadyServers: number;
      reason: string;
    };
    queueWorker: {
      ready: boolean;
      enabled: boolean;
      queuedJobs: number;
      runningJobs: number;
      staleRunningJobs: number;
      blockedJobs: number;
      reason: string;
    };
  };
  pressure: {
    servers: number;
    scannedJobs: number;
    queuedJobs: number;
    runningJobs: number;
    blockedJobs: number;
  };
  blockers: SupervisorBlocker[];
  nextSteps: SupervisorNextStep[];
}

export interface SupervisorAgentTaskPullReadiness {
  state: 'ready' | 'degraded' | 'blocked' | 'idle' | string;
  reason: string;
  gates: {
    runtime: {
      ready: boolean;
      targetSelectionEnabled: boolean;
      capableServers: number;
      onlineCapableServers: number;
      heartbeatEnabled: boolean;
      heartbeatTokenConfigured: boolean;
      heartbeatRequiredForTargetSelection: boolean;
      heartbeatServers: number;
      readyServers: number;
      issueServers: number;
      missingHeartbeatServers: number;
      reason: string;
    };
    queue: {
      ready: boolean;
      queueWorkerEnabled: boolean;
      readyJobs: number;
      scheduledJobs: number;
      runningJobs: number;
      staleRunningJobs: number;
      blockedJobs: number;
      failedJobs: number;
      cancelledJobs: number;
      reason: string;
    };
    pullContract: {
      ready: boolean;
      endpointImplemented: boolean;
      contractEndpointEnabled?: boolean;
      pullEndpointImplemented?: boolean;
      taskPullEnabled?: boolean;
      claimSupported: boolean;
      ackSupported: boolean;
      ackCancellationHintSupported?: boolean;
      ackProgressWritebackSupported?: boolean;
      lifecycleExecutionSupported?: boolean;
      reason: string;
    };
    audit: {
      ready: boolean;
      totalRecent: number;
      failedRecent: number;
      blockedRecent: number;
      highRiskRecent: number;
      reason: string;
    };
  };
  pressure: {
    readyJobs: number;
    scheduledJobs: number;
    runningJobs: number;
    staleRunningJobs: number;
    blockedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    pressureJobs: number;
  };
  samples: {
    nextQueuedJob?: SupervisorQueuedJobSample | null;
    blockedReasons: SupervisorBlockedReason[];
    blockedReasonSamples: SupervisorBlockedJobSample[];
  };
  blockers: SupervisorBlocker[];
  nextSteps: SupervisorNextStep[];
}
