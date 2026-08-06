import { describe, expect, it } from 'vitest';
import {
  environmentVersionKindLabelKey,
  releaseApprovalStatusLabelKey,
  releaseClientErrorLabelKey,
  releaseDeploymentStageStatusLabelKey,
  releaseEnvironmentLabelKey,
  releaseEnvironmentValueLabelKey,
  releaseExecutionStatusLabelKey,
  releaseOrderStatusLabelKey,
  releaseRiskLabelKey,
  releaseRunStatusLabelKey,
} from './release-copy.model';

describe('release copy model', () => {
  it('maps lifecycle and execution statuses without a raw fallback', () => {
    expect(releaseOrderStatusLabelKey('awaiting_approval')).toBe(
      'releaseOrderStatusAwaitingApproval',
    );
    expect(releaseOrderStatusLabelKey('future')).toBe('releaseOrderStatusUnknown');
    expect(releaseExecutionStatusLabelKey('completed')).toBe('releaseExecutionStatusCompleted');
    expect(releaseExecutionStatusLabelKey('future')).toBe('releaseExecutionStatusUnknown');
  });

  it('maps run, approval and stage statuses to localized keys', () => {
    expect(releaseRunStatusLabelKey('SUCCEEDED')).toBe('runStatusSucceeded');
    expect(releaseRunStatusLabelKey('future')).toBe('runStatusUnknown');
    expect(releaseApprovalStatusLabelKey('approved')).toBe('releaseApprovalStatusApproved');
    expect(releaseApprovalStatusLabelKey('future')).toBe('releaseApprovalStatusUnknown');
    expect(releaseDeploymentStageStatusLabelKey('completed')).toBe('runStageCompleted');
    expect(releaseDeploymentStageStatusLabelKey('future')).toBe('runStageUnknown');
  });

  it('maps EnvironmentVersion kind, environment role and risk labels', () => {
    expect(environmentVersionKindLabelKey('deploy')).toBe('environmentVersionKindDeploy');
    expect(environmentVersionKindLabelKey('upgrade')).toBe('environmentVersionKindUpgrade');
    expect(environmentVersionKindLabelKey('recovery')).toBe('environmentVersionKindRecovery');
    expect(environmentVersionKindLabelKey('future')).toBe('environmentVersionKindUnknown');
    expect(releaseEnvironmentLabelKey('staging')).toBe('releaseEnvironmentStaging');
    expect(releaseEnvironmentLabelKey('production')).toBe('releaseEnvironmentProduction');
    expect(releaseEnvironmentLabelKey('future')).toBe('releaseEnvironmentUnknown');
    expect(releaseEnvironmentValueLabelKey('Staging')).toBe('releaseEnvironmentStaging');
    expect(releaseEnvironmentValueLabelKey('Production')).toBe('releaseEnvironmentProduction');
    expect(releaseEnvironmentValueLabelKey('prod')).toBe('releaseEnvironmentProduction');
    expect(releaseEnvironmentValueLabelKey('custom')).toBeNull();
    expect(releaseRiskLabelKey('high')).toBe('riskHigh');
    expect(releaseRiskLabelKey('future')).toBe('riskUnknown');
  });

  it('recognizes only stable client copy error keys', () => {
    for (const key of [
      'releaseStagingScopeMismatch',
      'releaseProductionPreviewScopeMismatch',
      'releaseProductionRunScopeMismatch',
    ]) {
      expect(releaseClientErrorLabelKey(key)).toBe(key);
    }
    expect(releaseClientErrorLabelKey('backend detail')).toBeNull();
  });
});
