import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

/**
 * 测试用：构造一个真实的 `CryptoService`，使用固定 ENCRYPTION_KEY。
 *
 * 用于在 spec 中手动 `new SomeService(prisma, ..., cryptoService)` 时注入，
 * 这样加解密能跑真实往返（而不是 mock），与 `*.service.spec.ts` 现有的
 * "真加密 → 解密断言" 风格一致（见 resource-pool / admin / project-environment spec）。
 */
export function createTestCryptoService(encryptionKey = 'test-encryption-key-32-chars-ok!!!'): CryptoService {
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'ENCRYPTION_KEY') return encryptionKey;
      return fallback;
    }),
  } as unknown as ConfigService;
  return new CryptoService(configService);
}
