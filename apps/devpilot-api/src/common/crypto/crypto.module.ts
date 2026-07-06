import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/**
 * 全局加解密模块。任何 service 注入 `CryptoService` 即可，无需在各业务 Module 重复声明。
 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
