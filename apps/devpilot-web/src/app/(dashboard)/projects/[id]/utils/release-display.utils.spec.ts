import { describe, expect, it } from 'vitest';
import {
  buildErrorCodeTitle,
  foldTechnicalIds,
  humanizeByteCounts,
  humanizeEvidenceText,
  humanizeGateReason,
  providerKeyLabel,
  shortDigest,
  shortTechnicalId,
} from './release-display.utils';

describe('humanizeGateReason (ROD-5 防回归)', () => {
  it('把组描述里的 raw ISO 时间戳替换为本地 YYYY-MM-DD HH:mm', () => {
    const raw = '证据已于 2026-08-17T09:11:21.126Z 过期，必须重新检查';
    const out = humanizeGateReason(raw);
    expect(out).not.toMatch(/T\d{2}:\d{2}/);
    expect(out).toMatch(/证据已于 \d{4}-\d{2}-\d{2} \d{2}:\d{2} 过期，必须重新检查/);
  });

  it('兼容带时区偏移与无毫秒的 ISO 形态，且不动普通文本', () => {
    expect(humanizeGateReason('a 2026-08-17T09:11:21+08:00 b')).not.toContain('T09:11');
    expect(humanizeGateReason('无时间戳的描述')).toBe('无时间戳的描述');
  });
});

describe('foldTechnicalIds / humanizeEvidenceText (PX-3)', () => {
  it('折叠 25 位 cuid 为前 8 位', () => {
    const out = foldTechnicalIds('repository-connection:cms5vvpwu00cqobpavjx35cib;repository-ref:master');
    expect(out).toContain('cms5vvpw…');
    expect(out).not.toContain('cms5vvpwu00cqobpavjx35cib');
  });

  it('组合清洗：ISO + cuid + 字节数', () => {
    const out = humanizeEvidenceText('run cmrwxl1ks000k6enjiclutd5a at 2026-08-17T09:11:21.126Z 超 262144000 字节');
    expect(out).toContain('cmrwxl1k…');
    expect(out).not.toMatch(/T09:11:\d{2}/);
    expect(out).toContain('250MB');
  });
});

describe('humanizeByteCounts (PX-32)', () => {
  it('≥1MB 字节数转 MB，小数值不动', () => {
    expect(humanizeByteCounts('超过 262144000 字节上限')).toBe('超过 250MB（262144000 字节）上限');
    expect(humanizeByteCounts('相差 1024 字节')).toBe('相差 1024 字节');
  });
});

describe('short ids / digest / provider key', () => {
  it('shortTechnicalId 折叠长 ID 保留短值', () => {
    expect(shortTechnicalId('cmsn2fy8t001v3nfoizc1zlcy')).toBe('cmsn2fy8…');
    expect(shortTechnicalId('master')).toBe('master');
    expect(shortTechnicalId(null)).toBe('—');
  });

  it('shortDigest 统一 12 位短哈希', () => {
    expect(shortDigest(`sha256:${'a'.repeat(64)}`)).toBe(`sha256:${'a'.repeat(12)}…`);
    expect(shortDigest(undefined)).toBe('—');
  });

  it('providerKeyLabel 去版本后缀', () => {
    expect(providerKeyLabel('local-filesystem-v1')).toBe('local-filesystem');
    expect(providerKeyLabel(undefined)).toBe('—');
  });
});

describe('buildErrorCodeTitle (PX-32)', () => {
  it('已知枚举映射中文标题，未知返回 null', () => {
    expect(buildErrorCodeTitle('ARTIFACT_SECRET_CONTENT')).toBe('制品含疑似秘密内容');
    expect(buildErrorCodeTitle('BUILD_COMMAND_FAILED')).toBe('构建命令失败');
    expect(buildErrorCodeTitle('SOMETHING_ELSE')).toBeNull();
    expect(buildErrorCodeTitle(null)).toBeNull();
  });
});
