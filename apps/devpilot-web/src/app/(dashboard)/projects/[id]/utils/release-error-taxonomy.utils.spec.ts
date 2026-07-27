/**
 * classifyReleaseError 单元测试（CR-3-F3 回归）：
 * 验证前端从 err.details.code 优先读取业务字符串 code，正确触发 autoRepreview。
 *
 * 注：devpilot-web 暂未配置 jest 运行时；此 spec 在 tsconfig 中被排除 type-check，
 * 待 web 引入测试运行时后自动纳入。逻辑回归由 backend GlobalExceptionFilter spec +
 * 本文件的断言意图共同覆盖。
 */
import { ApiError } from '@svton/api-client';
import { classifyReleaseError } from './release-error-taxonomy.utils';

describe('classifyReleaseError (CR-3-F3 envelope code)', () => {
  it('ApiError 409 + details.code RELEASE_PLAN_STALE → preview_stale + autoRepreview', () => {
    // HTTP-error 路径：code=409（HTTP status），details 是信封体 {code:"RELEASE_PLAN_STALE",...}
    const err = new ApiError(409, '预览已过期，请重新生成', {
      code: 'RELEASE_PLAN_STALE',
      message: '预览已过期，请重新生成',
      data: null,
    });
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('preview_stale');
    expect(view.autoRepreview).toBe(true);
  });

  it('ApiError envelope path: code="RELEASE_PLAN_STALE" → preview_stale + autoRepreview', () => {
    // envelope 路径：code 本身就是字符串（unified-response.adapter 抛出时）
    const err = new ApiError('RELEASE_PLAN_STALE', '预览已过期', undefined);
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('preview_stale');
    expect(view.autoRepreview).toBe(true);
  });

  it('RELEASE_ENVIRONMENT_MISMATCH → env_mismatch, no autoRepreview', () => {
    const err = new ApiError(403, '环境不一致', { code: 'RELEASE_ENVIRONMENT_MISMATCH' });
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('env_mismatch');
    expect(view.autoRepreview).toBe(false);
  });

  it('RELEASE_SERVICE_NOT_IN_TARGET_ENV → env_mismatch', () => {
    const err = new ApiError(403, '服务不在目标环境', { code: 'RELEASE_SERVICE_NOT_IN_TARGET_ENV' });
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('env_mismatch');
  });

  it('RELEASE_PLAN_INVALID → env_mismatch', () => {
    const err = new ApiError(400, '校验失败', { code: 'RELEASE_PLAN_INVALID' });
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('env_mismatch');
  });

  it('409 status_transition (no envelope code) → status_transition, no autoRepreview', () => {
    const err = new ApiError(409, '计划当前状态 running 不可执行', undefined);
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('status_transition');
    expect(view.autoRepreview).toBe(false);
  });

  it('403 forbidden (rbac, no flag keyword) → rbac', () => {
    const err = new ApiError(403, '无权限', undefined);
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('rbac');
  });

  it('NETWORK_ERROR → network', () => {
    const err = new ApiError('NETWORK_ERROR', '网络错误', undefined);
    const view = classifyReleaseError(err);
    expect(view.kind).toBe('network');
  });

  it('non-ApiError → other with original message', () => {
    const view = classifyReleaseError(new Error('boom'));
    expect(view.kind).toBe('other');
    expect(view.message).toBe('boom');
  });
});
