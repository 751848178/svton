type ApplicationsPageActionsProps = {
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  onQueueDeploymentRunsChange: (value: boolean) => void;
  onQueueServiceOperationsChange: (value: boolean) => void;
  onRefresh: () => void;
};

export function ApplicationsPageActions({
  queueDeploymentRuns,
  queueServiceOperations,
  onQueueDeploymentRunsChange,
  onQueueServiceOperationsChange,
  onRefresh,
}: ApplicationsPageActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={queueDeploymentRuns}
          onChange={(event) => onQueueDeploymentRunsChange(event.target.checked)}
        />
        部署计划加入队列
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={queueServiceOperations}
          onChange={(event) => onQueueServiceOperationsChange(event.target.checked)}
        />
        服务操作加入队列
      </label>
      <button
        onClick={onRefresh}
        className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
      >
        刷新
      </button>
    </div>
  );
}
