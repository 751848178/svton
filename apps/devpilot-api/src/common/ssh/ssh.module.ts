import { Global, Module } from '@nestjs/common';
import { SshTransportFactory } from './ssh-transport.factory';

/**
 * SSH 传输基础设施模块。
 *
 * `SshLiveServerExecutorAdapter` 通过 `SshTransportFactory` 获取传输实现，
 * 消除对 `spawn('ssh', ...)` CLI 的直接依赖。
 */
@Global()
@Module({
  providers: [SshTransportFactory],
  exports: [SshTransportFactory],
})
export class SshModule {}
