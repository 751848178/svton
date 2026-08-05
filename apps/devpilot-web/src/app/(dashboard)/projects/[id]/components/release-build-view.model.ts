export type ReleaseBuildLabelKey =
  | 'releaseBuildStatusQueued'
  | 'releaseBuildStatusRunning'
  | 'releaseBuildStatusSucceeded'
  | 'releaseBuildStatusFailed'
  | 'releaseBuildStatusCanceled'
  | 'releaseBuildStatusUnknown';

const LABEL_KEYS: Record<string, ReleaseBuildLabelKey> = {
  queued: 'releaseBuildStatusQueued',
  running: 'releaseBuildStatusRunning',
  succeeded: 'releaseBuildStatusSucceeded',
  failed: 'releaseBuildStatusFailed',
  canceled: 'releaseBuildStatusCanceled',
};

export function releaseBuildStatusLabelKey(status: string) {
  return LABEL_KEYS[status] || 'releaseBuildStatusUnknown';
}

export function releaseBuildStatusTone(status: string) {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'running';
  return 'idle';
}

export function isReleaseBuildActive(status: string) {
  return status === 'queued' || status === 'running';
}
