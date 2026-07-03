import { Metric } from './ui-bits';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorSummary({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">
      <Metric
        label="Ready"
        value={supervisor.queue.ready}
      />
      <Metric
        label="Scheduled"
        value={supervisor.queue.scheduled}
      />
      <Metric
        label="Running"
        value={supervisor.queue.running}
      />
      <Metric
        label="Stale"
        value={supervisor.queue.staleRunning}
      />
      <Metric
        label="Active lease"
        value={supervisor.leases.running}
      />
      <Metric
        label="Workers"
        value={supervisor.workers.length}
      />
      <Metric
        label="Worker owner"
        value={supervisor.workerInventory.owners.total}
      />
      <Metric
        label="Owner stale"
        value={supervisor.workerInventory.owners.stale}
      />
      <Metric
        label="Agent targets"
        value={supervisor.agent.capableServers}
      />
      <Metric
        label="Agent runtime"
        value={supervisor.agent.runtime.onlineServers}
      />
      <Metric
        label="Agent stale"
        value={supervisor.agent.runtime.staleServers}
      />
      <Metric
        label="Agent ready"
        value={supervisor.agent.jobs.ready}
      />
    </div>
  );
}
