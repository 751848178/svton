# @svton/nestjs-queue

NestJS 队列模块，基于 BullMQ，简化任务队列使用。

## 安装

```bash
pnpm add @svton/nestjs-queue bullmq
```

## 使用

### 模块注册

```typescript
import { Module } from '@nestjs/common';
import { QueueModule } from '@svton/nestjs-queue';

@Module({
  imports: [
    QueueModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
      prefix: 'queue',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
})
export class AppModule {}
```

### 添加任务

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '@svton/nestjs-queue';

@Injectable()
export class EmailService {
  constructor(private readonly queueService: QueueService) {}

  async sendEmail(to: string, subject: string) {
    await this.queueService.addJob('email', 'send', {
      to,
      subject,
    }, {
      delay: 1000,        // 延迟 1 秒
      attempts: 3,        // 重试 3 次
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
}
```

### 处理任务

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService, Job } from '@svton/nestjs-queue';

@Injectable()
export class EmailProcessor implements OnModuleInit {
  constructor(private readonly queueService: QueueService) {}

  onModuleInit() {
    this.queueService.registerWorker('email', async (job: Job) => {
      const { to, subject } = job.data;
      // 发送邮件逻辑
      console.log(`Sending email to ${to}: ${subject}`);
    }, 5); // 并发数 5
  }
}
```

### 注入特定队列

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue, Queue } from '@svton/nestjs-queue';

@Injectable()
export class EmailService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendEmail(data: EmailData) {
    await this.emailQueue.add('send', data);
  }
}
```

需要先注册队列：

```typescript
QueueModule.registerQueue('email', 'notification')
```

## License

MIT
