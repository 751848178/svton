// @vitest-environment jsdom

/**
 * SET-7 focused spec：跨环境复用配置的目标环境必须从项目实际环境派生。
 * 遗留未使用种子环境（prod/test 等）不得出现在目标环境选择中。
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentEnvCopyDialog } from '../environment-env-copy-dialog';
import type { ProjectEnvironment } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

function env(id: string, key: string, name: string, status = 'active'): ProjectEnvironment {
  return {
    id,
    key,
    name,
    status,
  } as ProjectEnvironment;
}

describe('SET-7: 复用配置目标环境派生', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('settings detail derives copy targets from existing project environments, not the raw list', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(
      'src/app/(dashboard)/projects/[id]/components/settings/environment-settings-detail.tsx',
      'utf8',
    );
    // SET-7 回归锚点：若有人改回 detail.project?.environments ?? []，此断言失败。
    expect(source).toContain('selectExistingProjectEnvironments(detail.project?.environments)');
    expect(source).not.toContain('environments: detail.project?.environments ?? []');
  });

  it('copy dialog lists only same-project targets: source excluded, archived excluded', async () => {
    const copy = vi.fn().mockResolvedValue({});
    await act(async () => {
      root.render(
        <EnvironmentEnvCopyDialog
          open
          onClose={vi.fn()}
          environments={[
            env('env-dev', 'dev', '开发'),
            env('env-staging', 'staging', '预发'),
            env('env-archived', 'test', '测试', 'archived'),
          ]}
          sourceEnvironment={env('env-dev', 'dev', '开发')}
          plainVars={{ A: '1' }}
          secretRefs={[]}
          copy={copy}
          copying={false}
          onCopied={vi.fn()}
          t={((key: string) => key) as never}
        />,
      );
    });
    const body = document.body.textContent ?? '';
    expect(body).toContain('staging');
    expect(body).not.toContain('env-dev ·');
    expect(body).not.toContain('archived-target');
    const labels = [...document.querySelectorAll('label')].map((item) => item.textContent);
    expect(labels.some((label) => label?.includes('staging'))).toBe(true);
    expect(labels.some((label) => label?.includes('dev'))).toBe(false);
    expect(labels.some((label) => label?.includes('test'))).toBe(false);
  });
});
