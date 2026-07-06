import { NotFoundException } from '@nestjs/common';
import { CDNProvider } from '../../cdn/dto/cdn.dto';
import { AliyunCdnProvider } from './aliyun-cdn-provider';
import { CloudflareCdnProvider } from './cloudflare-cdn-provider';
import { CdnRefreshProviderFactory } from './cdn-refresh-provider.factory';
import { QiniuCdnProvider } from './qiniu-cdn-provider';
import { TencentCdnProvider } from './tencent-cdn-provider';

/**
 * CDN 刷新 provider 单元测试。
 *
 * 验证：factory 按厂商路由到正确实现、凭据缺失时抛错、provider 标识正确。
 * 真实 SDK 调用不在此测试（需真实凭据 + 网络），由集成/e2e 覆盖。
 */
describe('CdnRefreshProviderFactory routing', () => {
  // 用真实 provider 实例（它们的 provider 字段是静态 readonly，无需依赖网络）
  const factory = new CdnRefreshProviderFactory(
    new AliyunCdnProvider(),
    new TencentCdnProvider({} as never),
    new QiniuCdnProvider(),
    new CloudflareCdnProvider({} as never),
  );

  it('resolves each provider enum to its implementation', () => {
    expect(factory.resolve(CDNProvider.ALIYUN).provider).toBe('aliyun');
    expect(factory.resolve(CDNProvider.TENCENT).provider).toBe('tencent');
    expect(factory.resolve(CDNProvider.QINIU).provider).toBe('qiniu');
    expect(factory.resolve(CDNProvider.CLOUDFLARE).provider).toBe('cloudflare');
  });

  it('resolves by string value too', () => {
    expect(factory.resolve('aliyun').provider).toBe('aliyun');
    expect(factory.resolve('tencent').provider).toBe('tencent');
  });

  it('throws NotFoundException for unknown provider', () => {
    expect(() => factory.resolve('unknown')).toThrow(NotFoundException);
  });
});

describe('AliyunCdnProvider credential validation', () => {
  const provider = new AliyunCdnProvider();

  it('throws when credentials missing accessKeyId', async () => {
    await expect(
      provider.purge({ raw: { accessKeySecret: 'x' } }, ['https://a.com/'], false),
    ).rejects.toThrow('missing accessKeyId/accessKeySecret');
  });

  it('accepts both camelCase and UPPER case keys', async () => {
    // 不实际调 SDK，仅验证凭据解析不抛错（构造 client 会因网络失败，但凭据校验先过）
    await expect(
      provider.purge(
        { raw: { AccessKeyId: 'id', AccessKeySecret: 'secret' } },
        ['https://a.com/'],
        false,
      ),
    ).rejects.toThrow(/network|ECONN|fetch|getaddrinfo|aliyuncs|invalid/i);
  }, 15_000);
});

describe('CloudflareCdnProvider credential validation', () => {
  const provider = new CloudflareCdnProvider({} as never);

  it('throws when credentials missing apiToken/zoneId', async () => {
    await expect(
      provider.purge({ raw: { apiToken: 'x' } }, ['https://a.com/'], false),
    ).rejects.toThrow('missing apiToken/zoneId');
  });
});

describe('TencentCdnProvider credential validation', () => {
  const provider = new TencentCdnProvider({} as never);

  it('throws when credentials missing secretId/secretKey', async () => {
    await expect(
      provider.purge({ raw: { secretId: 'x' } }, ['https://a.com/'], false),
    ).rejects.toThrow('missing secretId/secretKey');
  });
});

describe('QiniuCdnProvider credential validation', () => {
  const provider = new QiniuCdnProvider();

  it('throws when credentials missing accessKey/secretKey', async () => {
    await expect(
      provider.purge({ raw: { accessKey: 'x' } }, ['https://a.com/'], false),
    ).rejects.toThrow('missing accessKey/secretKey');
  });
});
