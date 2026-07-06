import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createTestCryptoService } from '../common/crypto/crypto.test-helpers';
import { AliyunSlsLogQueryAdapter } from './aliyun-sls-log-query.adapter';
import { resolveLogRedactionPolicy } from './log-redaction';

type PrismaMock = {
  teamCredential: {
    findFirst: jest.Mock;
  };
};

describe('AliyunSlsLogQueryAdapter', () => {
  let prisma: PrismaMock;
  let config: { get: jest.Mock };
  let adapter: AliyunSlsLogQueryAdapter;

  beforeEach(() => {
    prisma = {
      teamCredential: {
        findFirst: jest.fn(),
      },
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'LOG_CENTER_SLS_LIVE_QUERY_ENABLED') return 'true';
        if (key === 'LOG_CENTER_SLS_QUERY_RETRY_ATTEMPTS') return '0';
        return fallback;
      }),
    };
    adapter = new AliyunSlsLogQueryAdapter(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      createTestCryptoService(),
    );
  });

  it('queries Aliyun SLS logs with TeamCredential and returns redacted live rows', async () => {
    prisma.teamCredential.findFirst.mockResolvedValue({
      id: 'credential-1',
      name: 'Aliyun logs',
      type: 'cloud_aliyun',
      config: JSON.stringify({
        accessKeyId: 'access-key-id',
        accessKeySecret: 'access-key-secret',
        slsEndpoint: 'cn-hangzhou.log.aliyuncs.com',
      }),
    });

    class FakeGetLogsRequest {
      constructor(public readonly options: Record<string, unknown>) {}
    }
    class FakeSlsClient {
      static options: Record<string, unknown> | null = null;
      static requests: Array<{ project: string; logstore: string; request: FakeGetLogsRequest }> = [];

      constructor(options: Record<string, unknown>) {
        FakeSlsClient.options = options;
      }

      async getLogs(project: string, logstore: string, request: FakeGetLogsRequest) {
        FakeSlsClient.requests.push({ project, logstore, request });
        return {
          body: [
            {
              __time__: 1782528000,
              level: 'error',
              message: 'token=secret failure for ops@example.test',
              requestId: 'req-1',
            },
          ],
        };
      }
    }

    (adapter as unknown as { loadAliyunSlsSdk: jest.Mock }).loadAliyunSlsSdk = jest
      .fn()
      .mockResolvedValue({
        Client: FakeSlsClient,
        GetLogsRequest: FakeGetLogsRequest,
      });

    const result = await adapter.query({
      teamId: 'team-1',
      credentialId: 'credential-1',
      project: 'prod-sls-project',
      logstore: 'app-log',
      region: 'cn-hangzhou',
      query: 'level:error',
      from: new Date('2026-06-27T00:00:00.000Z'),
      to: new Date('2026-06-27T00:15:00.000Z'),
      limit: 20,
      redactionPolicy: resolveLogRedactionPolicy({
        redaction: { maskEmails: true },
      }),
    });
    const liveResult = result.result as Record<string, unknown>;
    const preview = liveResult.preview as Record<string, unknown>;

    expect(FakeSlsClient.options).toEqual({
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      securityToken: undefined,
      regionId: 'cn-hangzhou',
      endpoint: 'cn-hangzhou.log.aliyuncs.com',
    });
    expect(FakeSlsClient.requests).toHaveLength(1);
    expect(FakeSlsClient.requests[0]).toEqual(expect.objectContaining({
      project: 'prod-sls-project',
      logstore: 'app-log',
    }));
    expect(FakeSlsClient.requests[0].request.options).toEqual(expect.objectContaining({
      query: 'level:error',
      line: 20,
      offset: 0,
      reverse: true,
    }));
    expect(result.status).toBe('completed');
    expect(liveResult).toEqual(expect.objectContaining({
      mode: 'aliyun_sls_live_query',
      executed: true,
      rowCount: 1,
      stdoutPreview: expect.stringContaining('token=[redacted] failure for [redacted-email]'),
    }));
    expect(preview.rows).toEqual([
      expect.objectContaining({
        message: 'token=[redacted] failure for [redacted-email]',
        requestId: 'req-1',
      }),
    ]);
  });

  it('blocks live queries when the feature flag is disabled', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'LOG_CENTER_SLS_LIVE_QUERY_ENABLED') return 'false';
      return fallback;
    });

    const result = await adapter.query({
      teamId: 'team-1',
      credentialId: 'credential-1',
      project: 'prod-sls-project',
      logstore: 'app-log',
      region: 'cn-hangzhou',
      query: '*',
      from: new Date('2026-06-27T00:00:00.000Z'),
      to: new Date('2026-06-27T00:15:00.000Z'),
      limit: 20,
      redactionPolicy: resolveLogRedactionPolicy(undefined),
    });

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      error: 'SLS live log query is disabled',
    }));
    expect(prisma.teamCredential.findFirst).not.toHaveBeenCalled();
  });
});
