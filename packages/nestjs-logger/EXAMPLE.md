# nestjs-logger 使用示例

## 基础示例

### 1. 简单配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from '@svton/nestjs-logger';

@Module({
  imports: [
    LoggerModule.forRoot({
      appName: 'my-api',
      level: 'info',
    }),
  ],
})
export class AppModule {}
```

### 2. 在 main.ts 中启用

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(3000);
}
bootstrap();
```

### 3. 在服务中使用

```typescript
// users.service.ts
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from '@svton/nestjs-logger';

@Injectable()
export class UsersService {
  constructor(
    @InjectPinoLogger(UsersService.name)
    private readonly logger: PinoLogger,
  ) {}

  async findOne(id: number) {
    this.logger.info({ userId: id }, 'Finding user');
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDto) {
    this.logger.info({ dto }, 'Creating user');
    try {
      const user = await this.prisma.user.create({ data: dto });
      this.logger.info({ userId: user.id }, 'User created successfully');
      return user;
    } catch (error) {
      this.logger.error({ err: error, dto }, 'Failed to create user');
      throw error;
    }
  }
}
```

## 阿里云 SLS 集成示例

### 完整配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '@svton/nestjs-logger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        appName: config.get('APP_NAME', 'my-api'),
        env: config.get('NODE_ENV', 'development'),
        level: config.get('LOG_LEVEL', 'info'),
        prettyPrint: config.get('NODE_ENV') !== 'production',
        excludeRoutes: ['/health', '/metrics'],
        cloudLogger: config.get('NODE_ENV') === 'production' ? {
          aliyunSls: {
            endpoint: config.get('ALIYUN_SLS_ENDPOINT'),
            accessKeyId: config.get('ALIYUN_ACCESS_KEY_ID'),
            accessKeySecret: config.get('ALIYUN_ACCESS_KEY_SECRET'),
            project: config.get('ALIYUN_SLS_PROJECT'),
            logstore: config.get('ALIYUN_SLS_LOGSTORE'),
            source: config.get('APP_NAME', 'my-api'),
            topic: 'application',
          },
        } : undefined,
      }),
    }),
  ],
})
export class AppModule {}
```

### 环境变量

```env
# .env.production
NODE_ENV=production
APP_NAME=my-api
LOG_LEVEL=info

# 阿里云 SLS
ALIYUN_SLS_ENDPOINT=cn-hangzhou.log.aliyuncs.com
ALIYUN_ACCESS_KEY_ID=LTAI5txxxxxxxxxxxxx
ALIYUN_ACCESS_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALIYUN_SLS_PROJECT=my-project
ALIYUN_SLS_LOGSTORE=app-logs
```

## 腾讯云 CLS 集成示例

### 完整配置

```typescript
// app.module.ts
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    appName: 'my-api',
    env: config.get('NODE_ENV'),
    level: config.get('LOG_LEVEL', 'info'),
    cloudLogger: {
      tencentCls: {
        endpoint: config.get('TENCENT_CLS_ENDPOINT'),
        secretId: config.get('TENCENT_SECRET_ID'),
        secretKey: config.get('TENCENT_SECRET_KEY'),
        topicId: config.get('TENCENT_CLS_TOPIC_ID'),
        source: 'my-api',
      },
    },
  }),
});
```

### 环境变量

```env
# .env.production
NODE_ENV=production
LOG_LEVEL=info

# 腾讯云 CLS
TENCENT_CLS_ENDPOINT=ap-guangzhou.cls.tencentcs.com
TENCENT_SECRET_ID=your-tencent-secret-id
TENCENT_SECRET_KEY=your-tencent-secret-key
TENCENT_CLS_TOPIC_ID=your-topic-id
```

## 双云服务集成示例

### 同时使用阿里云和腾讯云

```typescript
// app.module.ts
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    appName: 'my-api',
    env: config.get('NODE_ENV'),
    level: 'info',
    prettyPrint: false,
    cloudLogger: {
      // 阿里云 SLS
      aliyunSls: {
        endpoint: config.get('ALIYUN_SLS_ENDPOINT'),
        accessKeyId: config.get('ALIYUN_ACCESS_KEY_ID'),
        accessKeySecret: config.get('ALIYUN_ACCESS_KEY_SECRET'),
        project: config.get('ALIYUN_SLS_PROJECT'),
        logstore: config.get('ALIYUN_SLS_LOGSTORE'),
      },
      // 腾讯云 CLS
      tencentCls: {
        endpoint: config.get('TENCENT_CLS_ENDPOINT'),
        secretId: config.get('TENCENT_SECRET_ID'),
        secretKey: config.get('TENCENT_SECRET_KEY'),
        topicId: config.get('TENCENT_CLS_TOPIC_ID'),
      },
    },
  }),
});
```

## 高级用法示例

### 自定义字段

```typescript
LoggerModule.forRoot({
  appName: 'my-api',
  customProps: (req) => ({
    // 用户信息
    userId: req.user?.id,
    username: req.user?.username,
    
    // 租户信息
    tenantId: req.headers['x-tenant-id'],
    
    // 版本信息
    version: process.env.APP_VERSION,
    
    // 地理位置
    region: process.env.AWS_REGION,
  }),
});
```

### 结构化日志

```typescript
@Injectable()
export class OrderService {
  constructor(
    @InjectPinoLogger(OrderService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    // 记录操作开始
    this.logger.info({
      action: 'create_order',
      userId: dto.userId,
      items: dto.items.length,
      totalAmount: dto.totalAmount,
    }, 'Creating order');

    try {
      const order = await this.prisma.order.create({ data: dto });
      
      // 记录成功
      this.logger.info({
        action: 'create_order',
        orderId: order.id,
        userId: dto.userId,
        status: 'success',
        duration: Date.now() - startTime,
      }, 'Order created successfully');
      
      return order;
    } catch (error) {
      // 记录错误
      this.logger.error({
        action: 'create_order',
        userId: dto.userId,
        err: error,
        status: 'failed',
      }, 'Failed to create order');
      
      throw error;
    }
  }
}
```

### 性能监控

```typescript
@Injectable()
export class PaymentService {
  constructor(
    @InjectPinoLogger(PaymentService.name)
    private readonly logger: PinoLogger,
  ) {}

  async processPayment(orderId: string, amount: number) {
    const startTime = Date.now();
    
    this.logger.info({
      action: 'process_payment',
      orderId,
      amount,
    }, 'Processing payment');

    try {
      // 调用支付网关
      const result = await this.paymentGateway.charge(amount);
      
      const duration = Date.now() - startTime;
      
      this.logger.info({
        action: 'process_payment',
        orderId,
        amount,
        transactionId: result.transactionId,
        duration,
        status: 'success',
      }, 'Payment processed successfully');
      
      // 性能告警
      if (duration > 3000) {
        this.logger.warn({
          action: 'process_payment',
          orderId,
          duration,
          threshold: 3000,
        }, 'Payment processing is slow');
      }
      
      return result;
    } catch (error) {
      this.logger.error({
        action: 'process_payment',
        orderId,
        amount,
        err: error,
        duration: Date.now() - startTime,
      }, 'Payment processing failed');
      
      throw error;
    }
  }
}
```

### 业务指标日志

```typescript
@Injectable()
export class MetricsService {
  constructor(
    @InjectPinoLogger(MetricsService.name)
    private readonly logger: PinoLogger,
  ) {}

  logUserRegistration(user: User) {
    this.logger.info({
      metric: 'user_registration',
      userId: user.id,
      source: user.registrationSource,
      timestamp: Date.now(),
    }, 'User registered');
  }

  logOrderPlaced(order: Order) {
    this.logger.info({
      metric: 'order_placed',
      orderId: order.id,
      userId: order.userId,
      amount: order.totalAmount,
      itemCount: order.items.length,
      timestamp: Date.now(),
    }, 'Order placed');
  }

  logApiCall(endpoint: string, duration: number, statusCode: number) {
    this.logger.info({
      metric: 'api_call',
      endpoint,
      duration,
      statusCode,
      timestamp: Date.now(),
    }, 'API call completed');
  }
}
```

## 测试示例

### 单元测试

```typescript
import { Test } from '@nestjs/testing';
import { LoggerModule } from '@svton/nestjs-logger';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          appName: 'test',
          level: 'silent', // 测试时不输出日志
        }),
      ],
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should create user', async () => {
    const dto = { name: 'Test User', email: 'test@example.com' };
    const user = await service.create(dto);
    expect(user).toBeDefined();
  });
});
```

## Docker 部署示例

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# 环境变量
ENV NODE_ENV=production
ENV LOG_LEVEL=info

CMD ["node", "dist/main.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
      
      # 阿里云 SLS
      ALIYUN_SLS_ENDPOINT: cn-hangzhou.log.aliyuncs.com
      ALIYUN_ACCESS_KEY_ID: ${ALIYUN_ACCESS_KEY_ID}
      ALIYUN_ACCESS_KEY_SECRET: ${ALIYUN_ACCESS_KEY_SECRET}
      ALIYUN_SLS_PROJECT: my-project
      ALIYUN_SLS_LOGSTORE: app-logs
```

## Kubernetes 部署示例

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  ALIYUN_SLS_ENDPOINT: "cn-hangzhou.log.aliyuncs.com"
  ALIYUN_SLS_PROJECT: "my-project"
  ALIYUN_SLS_LOGSTORE: "app-logs"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  ALIYUN_ACCESS_KEY_ID: "your-access-key-id"
  ALIYUN_ACCESS_KEY_SECRET: "your-access-key-secret"
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-api
  template:
    metadata:
      labels:
        app: my-api
    spec:
      containers:
      - name: api
        image: my-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
```
