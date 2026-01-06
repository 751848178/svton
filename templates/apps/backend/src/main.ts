import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // 如果使用 @svton/nestjs-logger，启用 bufferLogs
    // bufferLogs: true,
  });

  // 如果使用 @svton/nestjs-logger，设置 logger
  // app.useLogger(app.get(Logger));

  // Raw body 中间件（用于对象存储回调验签）
  // 仅对特定路径启用，避免影响全局 JSON 解析
  app.use('/object-storage/callback', express.raw({ type: '*/*' }));

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger 文档
  const config = new DocumentBuilder()
    .setTitle('API 文档')
    .setDescription('项目 API 接口文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API Docs: http://localhost:${port}/api-docs`);
}

bootstrap();
