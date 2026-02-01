import { Transform } from 'stream';
import * as crypto from 'crypto';
import * as https from 'https';

export interface AliyunSlsConfig {
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  project: string;
  logstore: string;
  source?: string;
  topic?: string;
}

/**
 * 阿里云 SLS Transport for Pino
 */
export class AliyunSlsTransport extends Transform {
  private buffer: unknown[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize = 100;
  private readonly flushInterval = 3000; // 3 seconds

  constructor(private readonly config: AliyunSlsConfig) {
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
    this.sendToSls(logs).catch((error) => {
      console.error('Failed to send logs to Aliyun SLS:', error);
    });
  }

  private async sendToSls(logs: unknown[]): Promise<void> {
    const logGroup = {
      logs: logs.map((log) => {
        const logRecord = log as Record<string, unknown>;
        return {
          time: Math.floor((logRecord.time as number) / 1000) || Math.floor(Date.now() / 1000),
          contents: Object.entries(logRecord).map(([key, value]) => ({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          })),
        };
      }),
      topic: this.config.topic || '',
      source: this.config.source || '',
    };

    const body = JSON.stringify(logGroup);
    const path = `/logstores/${this.config.logstore}/shards/lb`;
    const date = new Date().toUTCString();
    const contentMd5 = crypto.createHash('md5').update(body).digest('hex').toUpperCase();
    
    const signature = this.generateSignature('POST', path, {
      'Content-Type': 'application/json',
      'Content-MD5': contentMd5,
      'Date': date,
      'x-log-apiversion': '0.6.0',
      'x-log-signaturemethod': 'hmac-sha1',
    });

    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: `${this.config.project}.${this.config.endpoint}`,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Content-MD5': contentMd5,
          'Date': date,
          'x-log-apiversion': '0.6.0',
          'x-log-signaturemethod': 'hmac-sha1',
          'Authorization': `LOG ${this.config.accessKeyId}:${signature}`,
        },
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          reject(new Error(`SLS returned status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  private generateSignature(method: string, path: string, headers: Record<string, string>): string {
    const canonicalHeaders = Object.entries(headers)
      .filter(([key]) => key.startsWith('x-log-') || key.startsWith('x-acs-'))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('\n');

    const stringToSign = [
      method,
      headers['Content-MD5'] || '',
      headers['Content-Type'] || '',
      headers['Date'] || '',
      canonicalHeaders,
      path,
    ].join('\n');

    return crypto
      .createHmac('sha1', this.config.accessKeySecret)
      .update(stringToSign)
      .digest('base64');
  }
}
