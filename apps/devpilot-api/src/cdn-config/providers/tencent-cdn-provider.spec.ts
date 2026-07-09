/**
 * TencentCdnProvider SDK 调用单元测试。
 *
 * 通过 jest.mock 替换 tencentcloud-sdk-nodejs-cdn，验证 provider 正确：
 *  - 用 credential 构造 Client
 *  - URL 刷新调 PurgeUrlsCache、目录刷新调 PurgePathCache
 *  - 返回 RequestId
 * 不触碰真实网络。
 */

const mockPurgeUrlsCache = jest.fn();
const mockPurgePathCache = jest.fn();

jest.mock('tencentcloud-sdk-nodejs-cdn', () => ({
  cdn: {
    v20180606: {
      Client: jest.fn().mockImplementation((config) => ({
        _config: config,
        PurgeUrlsCache: mockPurgeUrlsCache,
        PurgePathCache: mockPurgePathCache,
      })),
    },
  },
}));

import { TencentCdnProvider } from './tencent-cdn-provider';

describe('TencentCdnProvider SDK integration', () => {
  const provider = new TencentCdnProvider();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { cdn } = require('tencentcloud-sdk-nodejs-cdn');
  const ClientCtor = cdn.v20180606.Client;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls PurgeUrlsCache for URL purge and returns RequestId', async () => {
    mockPurgeUrlsCache.mockResolvedValueOnce({ RequestId: 'req-123' });
    const result = await provider.purge(
      { raw: { secretId: 'AKIDtest', secretKey: 'shhh' } },
      ['https://a.com/x', 'https://b.com/y'],
      false,
    );
    expect(ClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        credential: { secretId: 'AKIDtest', secretKey: 'shhh' },
      }),
    );
    expect(mockPurgeUrlsCache).toHaveBeenCalledWith({
      Urls: ['https://a.com/x', 'https://b.com/y'],
    });
    expect(mockPurgePathCache).not.toHaveBeenCalled();
    expect(result.requestId).toBe('req-123');
  });

  it('calls PurgePathCache for directory purge', async () => {
    mockPurgePathCache.mockResolvedValueOnce({ RequestId: 'req-456' });
    const result = await provider.purge(
      { raw: { SecretId: 'AKIDtest', SecretKey: 'shhh' } },
      ['https://a.com/dir/', 'https://b.com/dir2/'],
      true,
    );
    expect(mockPurgePathCache).toHaveBeenCalledWith({
      Paths: ['https://a.com/dir/', 'https://b.com/dir2/'],
    });
    expect(mockPurgeUrlsCache).not.toHaveBeenCalled();
    expect(result.requestId).toBe('req-456');
  });

  it('does NOT leak secretKey in headers (regression: old impl put it in X-TC-Secret-Key)', async () => {
    mockPurgeUrlsCache.mockResolvedValueOnce({ RequestId: 'r' });
    await provider.purge(
      { raw: { secretId: 'AKIDtest', secretKey: 'topsecret' } },
      ['https://a.com/'],
      false,
    );
    // SDK 构造配置只含 credential 对象，无 http header 携带明文 key
    const configArg = ClientCtor.mock.calls[0][0];
    expect(JSON.stringify(configArg)).not.toContain('X-TC-Secret-Key');
    expect(JSON.stringify(configArg)).not.toContain('Signature=');
  });

  it('returns undefined requestId when SDK omits it', async () => {
    mockPurgeUrlsCache.mockResolvedValueOnce({});
    const result = await provider.purge(
      { raw: { secretId: 'id', secretKey: 'key' } },
      ['https://a.com/'],
      false,
    );
    expect(result.requestId).toBeUndefined();
  });
});
