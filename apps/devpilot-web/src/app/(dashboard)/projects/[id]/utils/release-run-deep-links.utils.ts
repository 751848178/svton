/** 构造发布尝试关联运行的精确前端落点。 */
export function buildDeploymentRunHref(projectId: string, runId: string): string {
  const query = new URLSearchParams({
    tab: 'deployments',
    runId,
  });
  return `/projects/${encodeURIComponent(projectId)}?${query.toString()}`;
}

export function buildServerExecutionJobHref(jobId: string): string {
  return `/execution-governance?jobId=${encodeURIComponent(jobId)}`;
}
