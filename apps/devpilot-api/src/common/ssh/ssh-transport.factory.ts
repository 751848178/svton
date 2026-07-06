import { Injectable } from '@nestjs/common';
import { Ssh2Transport } from './ssh2-transport';
import { SshTransport, SshTransportCredentials } from './ssh-transport';

/**
 * SSH 传输工厂。
 *
 * 生产实现始终返回 {@link Ssh2Transport}。测试可通过子类化或 NestJS override
 * 注入 mock transport，从而避免依赖真实 ssh2 连接。
 */
@Injectable()
export class SshTransportFactory {
  create(credentials: SshTransportCredentials): SshTransport {
    return new Ssh2Transport(credentials);
  }
}
