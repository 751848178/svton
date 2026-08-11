import type { ReleaseDeploymentTargetReadiness } from '../types/release-gate.types';

export function environmentVersionTargetReadiness(
  readiness: ReleaseDeploymentTargetReadiness,
  environmentName: string,
  locale: string,
) {
  const reasons = {
    TARGET_READY: ['', ''],
    TARGET_MISSING: [
      `${environmentName} 尚未绑定部署目标`,
      `${environmentName} has no deployment target`,
    ],
    TARGET_DUPLICATED: [
      `${environmentName} 存在重复的部署目标绑定`,
      `${environmentName} has duplicate deployment targets`,
    ],
    PROVIDER_MISMATCH: [
      '部署目标与当前 Provider 不匹配',
      'Deployment target does not match the current Provider',
    ],
    SSH_ROOT_INVALID: [
      'SSH 部署根目录缺失或不安全',
      'SSH deployment root is missing or unsafe',
    ],
    SSH_CONNECTION_INVALID: [
      'SSH 服务器未在线或连接信息无效',
      'SSH server is offline or its connection settings are invalid',
    ],
  } as const;
  return {
    ready: readiness.matchState === 'ready',
    reason: reasons[readiness.reasonCode][locale.startsWith('zh') ? 0 : 1],
  };
}
