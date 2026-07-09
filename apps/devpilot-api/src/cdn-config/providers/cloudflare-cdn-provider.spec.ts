/**
 * CloudflareCdnProvider SDK 调用单元测试。
 *
 * 通过 jest.mock 替换 cloudflare 模块，验证 provider 正确：
 *  - 用 apiToken 构造 Cloudflare client
 *  - 有 urls 时按 files 刷新、无 urls 时 purge_everything
 *  - 返回 result.id 作为 requestId
 * 不触碰真实网络。
 */

const mockPurge = jest.fn();

jest.mock('cloudflare', () => ({
  Cloudflare: jest.fn().mockImplementation((config) => ({
    _config: config,
    cache: { purge: mockPurge },
  })),
}));

import { Cloudflare } from 'cloudflare';
import { CloudflareCdnProvider } from './cloudflare-cdn-provider';

describe('CloudflareCdnProvider SDK integration', () => {
  const provider = new CloudflareCdnProvider();
  // Cloudflare 已被 jest.mock 替换为 mock constructor，引用它做断言
  const CloudflareMock = Cloudflare as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('purges specific files when urls provided', async () => {
    mockPurge.mockResolvedValueOnce({ id: 'purge-id-1' });
    const result = await provider.purge(
      { raw: { apiToken: 'tok', zoneId: 'zone-1' } },
      ['https://a.com/x', 'https://b.com/y'],
      false,
    );
    expect(CloudflareMock).toHaveBeenCalledWith({ apiToken: 'tok' });
    expect(mockPurge).toHaveBeenCalledWith({
      zone_id: 'zone-1',
      files: ['https://a.com/x', 'https://b.com/y'],
    });
    expect(result.requestId).toBe('purge-id-1');
  });

  it('purges everything when urls empty', async () => {
    mockPurge.mockResolvedValueOnce({ id: 'purge-id-2' });
    const result = await provider.purge(
      { raw: { apiToken: 'tok', zoneId: 'zone-1' } },
      [],
      false,
    );
    expect(mockPurge).toHaveBeenCalledWith({
      zone_id: 'zone-1',
      purge_everything: true,
    });
    expect(result.requestId).toBe('purge-id-2');
  });

  it('accepts UPPER case credential keys', async () => {
    mockPurge.mockResolvedValueOnce({ id: 'r' });
    await provider.purge(
      { raw: { API_TOKEN: 'tok', ZONE_ID: 'zone-9' } },
      ['https://a.com/'],
      false,
    );
    expect(mockPurge).toHaveBeenCalledWith(
      expect.objectContaining({ zone_id: 'zone-9', files: ['https://a.com/'] }),
    );
  });

  it('returns undefined requestId when SDK omits id', async () => {
    mockPurge.mockResolvedValueOnce({});
    const result = await provider.purge(
      { raw: { apiToken: 'tok', zoneId: 'zone-1' } },
      ['https://a.com/'],
      false,
    );
    expect(result.requestId).toBeUndefined();
  });
});
