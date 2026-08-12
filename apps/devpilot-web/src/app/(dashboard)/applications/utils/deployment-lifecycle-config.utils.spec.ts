import { describe, expect, it } from 'vitest';
import {
  mergeServiceDeploymentConfig,
  readServiceDeploymentForm,
} from './deployment-lifecycle-config.utils';

describe('deployment lifecycle resource requirements', () => {
  it('round-trips explicit CPU, memory and disk requirements', () => {
    const form = readServiceDeploymentForm({
      deployConfig: {
        healthCheckUrl: 'http://127.0.0.1:3000/health',
        resourceRequirements: {
          cpuMillicores: 250, memoryBytes: 134217728, diskBytes: 67108864,
        },
      },
    } as never);
    expect(form).toMatchObject({
      cpuMillicores: '250', memoryBytes: '134217728', diskBytes: '67108864',
    });
    expect(mergeServiceDeploymentConfig({}, form)).toMatchObject({
      resourceRequirements: {
        cpuMillicores: 250, memoryBytes: 134217728, diskBytes: 67108864,
      },
    });
  });

  it('rejects a partial requirement declaration', () => {
    const form = readServiceDeploymentForm();
    form.cpuMillicores = '100';
    expect(() => mergeServiceDeploymentConfig({
      resourceRequirements: { cpuMillicores: 1, memoryBytes: 1, diskBytes: 1 },
    }, form)).toThrow('RESOURCE_REQUIREMENTS_INCOMPLETE');
  });
});
