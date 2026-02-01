import { ConfigService } from '@nestjs/config';
import { PaymentModuleOptions } from '@svton/nestjs-payment';
import * as fs from 'fs';

/**
 * 读取密钥文件
 * @param filePath 文件路径
 * @returns 文件内容
 */
function readKeyFile(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    throw new Error(`Key file not found: ${filePath}`);
  } catch (error) {
    throw new Error(
      `Failed to read key file: ${filePath}. Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const usePaymentConfig = (
  configService: ConfigService,
): PaymentModuleOptions => ({
  wechat: {
    mchId: configService.getOrThrow('WECHAT_MCH_ID'),
    privateKey: readKeyFile(
      configService.get('WECHAT_PRIVATE_KEY', './certs/apiclient_key.pem'),
    ),
    serialNo: configService.getOrThrow('WECHAT_SERIAL_NO'),
    apiV3Key: configService.getOrThrow('WECHAT_API_V3_KEY'),
    appId: configService.getOrThrow('WECHAT_APP_ID'),
  },
  alipay: {
    appId: configService.getOrThrow('ALIPAY_APP_ID'),
    privateKey: readKeyFile(
      configService.get('ALIPAY_PRIVATE_KEY', './certs/alipay_private_key.pem'),
    ),
    alipayPublicKey: readKeyFile(
      configService.get('ALIPAY_PUBLIC_KEY', './certs/alipay_public_key.pem'),
    ),
  },
});
