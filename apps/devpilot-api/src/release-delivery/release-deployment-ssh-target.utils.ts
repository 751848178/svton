export function releaseDeploymentSshTargetRef(input: {
  username: string;
  host: string;
  port: number;
  root: string;
}) {
  return `ssh://${input.username}@${input.host}:${input.port}${input.root}`;
}

export function isSafeReleaseDeploymentSshRoot(value: string) {
  return /^\/[A-Za-z0-9_./-]+$/.test(value) && !value.split("/").includes("..");
}
