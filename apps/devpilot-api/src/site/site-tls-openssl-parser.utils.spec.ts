import * as crypto from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parseOpenSslCertificateText,
  parseOpenSslDate,
  parseX509FromPem,
} from './site-tls-openssl-parser.utils';

/**
 * 用 openssl CLI 生成一个 self-signed cert PEM，供测试解析。
 * 动态生成避免硬编码会过期的证书；若 openssl 不可用则跳过 PEM 相关用例。
 */
function generateTestPem(subject = '/CN=tls-probe-test.example.com/O=TestOrg'): string | null {
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'devpilot-tls-test-'));
    const pemPath = path.join(tmp, 'cert.pem');
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout /dev/null -out ${pemPath} -days 365 -nodes -subj "${subject}" -sha256`,
      { stdio: 'ignore' },
    );
    const pem = fs.readFileSync(pemPath, 'utf8');
    fs.rmSync(tmp, { recursive: true, force: true });
    return pem;
  } catch {
    return null;
  }
}

describe('parseOpenSslDate', () => {
  it('parses standard openssl English month format (LC_ALL=C output)', () => {
    const d = parseOpenSslDate('Jul  8 12:00:00 2026 GMT');
    expect(d).not.toBeNull();
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(6); // July (0-based)
    expect(d?.getUTCDate()).toBe(8);
    expect(d?.getUTCHours()).toBe(12);
  });

  it('parses single-digit day with extra space', () => {
    const d = parseOpenSslDate('Sep  5 00:00:00 2026 GMT');
    expect(d?.getUTCMonth()).toBe(8);
    expect(d?.getUTCDate()).toBe(5);
  });

  it('returns null for non-English locale month (was producing Invalid Date before fix)', () => {
    // 中文 locale 下的 openssl 输出 —— 显式解析器不匹配，回退 Date 也失败 → null
    expect(parseOpenSslDate('9月 15 23:59:59 2027 GMT')).toBeNull();
  });

  it('falls back to Date for ISO/standard formats', () => {
    const d = parseOpenSslDate('2026-07-08T12:00:00.000Z');
    expect(d?.getUTCFullYear()).toBe(2026);
  });

  it('returns null for empty or garbage', () => {
    expect(parseOpenSslDate(undefined)).toBeNull();
    expect(parseOpenSslDate('')).toBeNull();
    expect(parseOpenSslDate('not a date')).toBeNull();
  });
});

describe('parseOpenSslCertificateText', () => {
  it('extracts key/value fields from openssl x509 -noout output', () => {
    const text = [
      'subject=CN=test.example.com, O=TestOrg',
      'issuer=CN=test.example.com, O=TestOrg',
      'serial=567CC75A',
      'notBefore=Jul  8 04:40:15 2026 GMT',
      'notAfter=Jul  8 04:40:15 2027 GMT',
      'sha256 Fingerprint=28:B0:AC:0C:B9:6F',
    ].join('\n');
    const parsed = parseOpenSslCertificateText(text);
    expect(parsed.subject).toBe('CN=test.example.com, O=TestOrg');
    expect(parsed.serialNumber).toBe('567CC75A');
    expect(parsed.notAfter).toBe('Jul  8 04:40:15 2027 GMT');
    expect(parsed.fingerprintSha256).toBe('28:B0:AC:0C:B9:6F');
  });

  it('ignores lines without = separator', () => {
    const parsed = parseOpenSslCertificateText('noise line\nnotAfter=Sep 1 2026');
    expect(parsed.notAfter).toBe('Sep 1 2026');
  });
});

describe('parseX509FromPem', () => {
  const pem = generateTestPem();
  const pemCondition = pem ? it : it.skip;

  pemCondition('parses a real PEM into structured fields', () => {
    const result = parseX509FromPem(pem!);
    expect(result).not.toBeNull();
    expect(result!.subject).toContain('tls-probe-test.example.com');
    expect(result!.notAfter).toBeTruthy();
    expect(result!.fingerprintSha256).toMatch(/^sha256:|[0-9A-F:]+/i);
  });

  it('returns null when text contains no PEM block', () => {
    expect(parseX509FromPem('subject=CN=test\nnotAfter=Jul 8 2026')).toBeNull();
  });

  it('returns null for truncated PEM', () => {
    const truncated = '-----BEGIN CERTIFICATE-----\nMIIBasdf==';
    expect(parseX509FromPem(truncated)).toBeNull();
  });

  it('extracts PEM even when surrounded by other text (mixed stdout)', () => {
    if (!pem) return;
    const mixed = `some prefix line\n${pem}\ntrailing line`;
    const result = parseX509FromPem(mixed);
    expect(result).not.toBeNull();
    expect(result!.subject).toContain('tls-probe-test.example.com');
  });
});

describe('extractSiteTlsProbeMetadata prefers PEM then falls back to text', () => {
  // 间接验证：通过 site-tls-probe 的 extractSiteTlsProbeMetadata 确认 PEM 优先 + 文本回退
  // 见 site-tls-probe 集成测试
  it('test scaffolding sanity: crypto.X509Certificate is available', () => {
    expect(typeof crypto.X509Certificate).toBe('function');
  });
});
