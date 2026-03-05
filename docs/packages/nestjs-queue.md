# @svton/nestjs-queue

> NestJS 队列模块 - 基于 BullMQ 的任务队列

---

## 📦 包信息

| 属性 | 值 |
|------|---|
| **包名** | `@svton/nestjs-queue` |
| **版本** | `2.0.0` |
| **入口** | `dist/index.js` (CJS) / `dist/index.mjs` (ESM) |
| **类型** | `dist/index.d.ts` |

---

## 🎯 设计原则

1. **简化 API** - 封装 BullMQ 复杂性，提供简洁接口
2. **装饰器驱动** - 通过装饰器定义处理器
3. **类型安全** - 完整的 TypeScript 支持

---

## 🚀 快速开始

### 安装

```bash
pnpm add @svton/nestjs-queue
```

### 模块注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { QueueModule } from '@svton/nestjs-queue';

@Module({
  imports: [
    QueueModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
        password: 'your-password',
      },
      prefix: 'queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
  ],
})
export class AppModule {}
```

### 异步配置

```typescript
QueueModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get('REDIS_HOST'),
      port: config.get('REDIS_PORT'),
      password: config.get('REDIS_PASSWORD'),
    },
    prefix: config.get('QUEUE_PREFIX', 'queue'),
  }),
});
```

---

## ⚙️ 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `connection` | `ConnectionOptions` | - | Redis 连接配置 |
| `prefix` | `string` | - | 队列前缀 |
| `defaultJobOptions` | `JobsOptions` | - | 默认 Job 配置 |

---

## 🔧 使用方法

### QueueService

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '@svton/nestjs-queue';

@Injectable()
export class EmailService {
  constructor(private queueService: QueueService) {}

  // 添加任务到队列
  async sendEmail(to: string, subject: string, body: string) {
    await this.queueService.addJob('email', 'send', {
      to,
      subject,
      body,
    });
  }

  // 添加延迟任务
  async scheduleEmail(to: string, subject: string, body: string, delay: number) {
    await this.queueService.addJob('email', 'send', {
      to,
      subject,
      body,
    }, {
      delay, // 延迟毫秒数
    });
  }

  // 批量添加任务
  async sendBulkEmails(emails: Array<{ to: string; subject: string; body: string }>) {
    await this.queueService.addBulk('email', emails.map(email => ({
      name: 'send',
      data: email,
    })));
  }
}
```

### 定义处理器

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@svton/nestjs-queue';
import type { Job } from '@svton/nestjs-queue';

@Processor({ name: 'email' })
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process('send')
  async handleSend(job: Job<{ to: string; subject: string; body: string }>) {
    this.logger.log(`Sending email to ${job.data.to}`);
    
    // 发送邮件逻辑
    await this.sendEmail(job.data);
    
    this.logger.log(`Email sent to ${job.data.to}`);
  }

  @Process('welcome')
  async handleWelcome(job: Job<{ userId: number }>) {
    // 发送欢迎邮件
  }

  private async sendEmail(data: { to: string; subject: string; body: string }) {
    // 实际发送邮件的逻辑
  }
}
```

### 注入特定队列

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@svton/nestjs-queue';
import type { Queue } from '@svton/nestjs-queue';

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  async sendPush(userId: number, message: string) {
    await this.notificationQueue.add('push', { userId, message });
  }
}
```

需要先注册队列：

```typescript
// app.module.ts
@Module({
  imports: [
    QueueModule.forRoot({ /* ... */ }),
    QueueModule.registerQueue('notification', 'email'),
  ],
})
export class AppModule {}
```

---

## 📋 QueueService API

```typescript
// 获取队列
queueService.getQueue(name: string): Queue

// 添加任务
await queueService.addJob<T>(
  queueName: string,
  jobName: string,
  data: T,
  opts?: JobsOptions
): Promise<Job<T>>

// 批量添加任务
await queueService.addBulk<T>(
  queueName: string,
  jobs: Array<{ name: string; data: T; opts?: JobsOptions }>
): Promise<Job<T>[]>

// 注册 Worker
queueService.registerWorker(
  queueName: string,
  processor: (job: Job) => Promise<unknown>,
  concurrency?: number
): Worker

// 获取队列状态
await queueService.getQueueStatus(queueName: string): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}>

// 清空队列
await queueService.drain(queueName: string, delayed?: boolean): Promise<void>

// 暂停队列
await queueService.pause(queueName: string): Promise<void>

// 恢复队列
await queueService.resume(queueName: string): Promise<void>
```

---

## 📋 Job 配置选项

```typescript
interface JobsOptions {
  // 延迟执行（毫秒）
  delay?: number;
  
  // 重试次数
  attempts?: number;
  
  // 重试策略
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  
  // 优先级（数字越小优先级越高）
  priority?: number;
  
  // 任务超时（毫秒）
  timeout?: number;
  
  // 是否移除已完成的任务
  removeOnComplete?: boolean | number;
  
  // 是否移除失败的任务
  removeOnFail?: boolean | number;
  
  // 任务 ID（用于去重）
  jobId?: string;
}
```

---

## 📋 常用场景

### 邮件发送

```typescript
@Injectable()
export class EmailService {
  constructor(private queueService: QueueService) {}

  async sendWelcomeEmail(userId: number) {
    await this.queueService.addJob('email', 'welcome', { userId });
  }

  async sendPasswordReset(email: string, token: string) {
    await this.queueService.addJob('email', 'password-reset', {
      email,
      token,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}

@Processor({ name: 'email' })
@Injectable()
export class EmailProcessor {
  @Process('welcome')
  async handleWelcome(job: Job<{ userId: number }>) {
    const user = await this.usersService.findOne(job.data.userId);
    await this.mailer.send({
      to: user.email,
      subject: '欢迎注册',
      template: 'welcome',
      context: { name: user.name },
    });
  }
}
```

### 定时任务

```typescript
@Injectable()
export class ReportService {
  constructor(private queueService: QueueService) {}

  // 每天凌晨生成报表
  async scheduleDaily() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const delay = tomorrow.getTime() - Date.now();
    
    await this.queueService.addJob('report', 'daily', {
      date: new Date().toISOString().split('T')[0],
    }, { delay });
  }
}
```

### 图片处理

```typescript
@Injectable()
export class ImageService {
  constructor(private queueService: QueueService) {}

  async processImage(imageId: string) {
    await this.queueService.addJob('image', 'process', { imageId }, {
      timeout: 60000, // 1 分钟超时
      attempts: 2,
    });
  }
}

@Processor({ name: 'image', concurrency: 3 })
@Injectable()
export class ImageProcessor {
  @Process('process')
  async handleProcess(job: Job<{ imageId: string }>) {
    // 生成缩略图、压缩等
  }
}
```

---

## ✅ 最佳实践

1. **合理设置重试策略**
   ```typescript
   {
     attempts: 3,
     backoff: { type: 'exponential', delay: 1000 },
   }
   ```

2. **设置任务超时**
   ```typescript
   { timeout: 30000 } // 30 秒超时
   ```

3. **清理已完成的任务**
   ```typescript
   {
     removeOnComplete: 100, // 保留最近 100 个
     removeOnFail: 50,
   }
   ```

4. **使用优先级**
   ```typescript
   // 高优先级任务
   { priority: 1 }
   
   // 低优先级任务
   { priority: 10 }
   ```

5. **监控队列状态**
   ```typescript
   const status = await queueService.getQueueStatus('email');
   console.log(`Waiting: ${status.waiting}, Active: ${status.active}`);
   ```

---

**相关文档**: [@svton/nestjs-redis](./nestjs-redis.md) | [后端模块开发](../backend/modules.md)
