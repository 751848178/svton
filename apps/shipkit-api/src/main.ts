import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '256kb' }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 8770), '127.0.0.1');
}
void bootstrap().catch(() => { console.error('Shipkit API 启动失败，请检查数据库迁移与本机配置'); process.exitCode = 1; });
