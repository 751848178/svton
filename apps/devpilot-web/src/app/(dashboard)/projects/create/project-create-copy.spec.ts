import { describe, expect, it } from 'vitest';
import en from '../../../../../messages/en.json';
import zh from '../../../../../messages/zh.json';
import { ROUTE_SEGMENT_LABEL_KEYS } from '@/components/layout/route-labels';

describe('project creation UI copy', () => {
  it('uses the V13 creation journey terminology in both locales', () => {
    expect(zh.projects).toMatchObject({
      intakeTitle: '创建项目',
      intakeCancel: '取消创建',
      intakeSteps: '创建项目步骤',
      intakeProjectName: '项目名称',
      intakeRepositoryAddress: '仓库地址',
      intakeConnectAndAnalyze: '下一步',
    });
    expect(en.projects).toMatchObject({
      intakeTitle: 'Create Project',
      intakeCancel: 'Cancel creation',
      intakeSteps: 'Create project steps',
    });
    expect(ROUTE_SEGMENT_LABEL_KEYS.create).toBe('createProject');
  });
});
