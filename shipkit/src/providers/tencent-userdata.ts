// cloud-init user-data for dynamic builders: optional pre-install snippet + one curl-pipe
// to a controller-served (or self-hosted) installer.

export function renderCloudInit(o: { installUrl: string; preInstall?: string }): string {
  const safeUrl = o.installUrl.replace(/'/g, '%27');
  const lines = [
    '#!/bin/bash',
    'set -euo pipefail',
    'exec > /var/log/ship-bootstrap.log 2>&1',
  ];
  if (o.preInstall) lines.push(o.preInstall);
  lines.push(`curl -fsSL '${safeUrl}' | bash`, '');
  return lines.join('\n');
}
