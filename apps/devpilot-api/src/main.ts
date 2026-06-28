import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // 使用 Nest 默认日志，避免预览环境中 Pino provider 注入差异导致启动失败。
  app.useLogger(new Logger());

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS 配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3100',
    credentials: true,
  });

  // API 前缀
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3101;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Initializer API is running on: http://localhost:${port}`);
}

bootstrap();
