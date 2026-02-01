import { Transform } from 'stream';
import * as crypto from 'crypto';
import * as https from 'https';

export interface TencentClsConfig {
  endpoint: string;
  secretId: string;
  secretKey: string;
  topicId: string;
  source?: string;
}

/**
 * 腾讯云 CLS Transport for Pino
 */
export class TencentClsTransport extends Transform {
  private buffer: unknown[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize = 100;
  private readonly flushInterval = 3000; // 3 seconds

  constructor(private readonly config: TencentClsConfig) {
    super({ objectMode: true });
    this.startFlushTimer();
  }

  _transform(chunk: unknown, _encoding: string, callback: () => void): void {
    this.buffer.push(chunk);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
    
    callback();
  }

  _final(callback: () => void): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.flush();
    callback();
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private flush(): void {
    if (this.buffer.length === 0) return;

    const logs = this.buffer.splice(0, this.batchSize);
    this.sendToCls(logs).catch((error) => {
      console.error('Failed to send logs to Tencent CLS:', error);
    });
  }

  private async sendToCls(logs: unknown[]): Promise<void> {
    const logItems = logs.map((log) => {
      const logRecord = log as Record<string, unknown>;
      return {
        time: Math.floor((logRecord.time as number) / 1000) || Math.floor(Date.now() / 1000),
        contents: Object.entries(logRecord).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        })),
      };
    });

    const body = JSON.stringify(logItems);
    const path = '/structuredlog';
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 1000000);

    const params = {
      Action: 'UploadLog',
      SecretId: this.config.secretId,
      Timestamp: timestamp.toString(),
      Nonce: nonce.toString(),
      TopicId: this.config.topicId,
    };

    const signature = this.generateSignature('POST', path, params);

    return new Promise((resolve, reject) => {
      const queryString = new URLSearchParams({
        ...params,
        Signature: signature,
      }).toString();

      const req = https.request({
        hostname: this.config.endpoint,
        port: 443,
        path: `${path}?${queryString}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`CLS returned status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private generateSignature(method: string, path: string, params: Record<string, string>): string {
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const stringToSign = `${method}${this.config.endpoint}${path}?${sortedParams}`;

    return crypto
      .createHmac('sha1', this.config.secretKey)
      .update(stringToSign)
      .digest('base64');
  }
}
