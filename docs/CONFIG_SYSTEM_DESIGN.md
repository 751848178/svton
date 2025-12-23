# 配置系统设计方案

## 背景

当前问题：
1. COS 配置写死在环境变量中，无法动态修改
2. 系统配置项分散在代码中，缺乏统一管理
3. 需要重启服务才能生效配置变更

## 设计目标

1. **动态配置**: 管理员可在后台动态修改配置，无需重启
2. **灵活扩展**: 新增配置项无需修改表结构
3. **类型安全**: 配置项支持多种数据类型
4. **权限控制**: 不同配置项有不同的访问权限
5. **版本管理**: 支持配置变更历史追溯

---

## 数据库设计

### 1. 配置表 (config)

采用 **EAV (Entity-Attribute-Value)** 模式，支持动态配置。

```prisma
// schema.prisma

model Config {
  id          Int       @id @default(autoincrement())
  key         String    @unique  // 配置键，如 'storage.cos.secretId'
  value       String    @db.Text // 配置值（JSON字符串）
  type        String    // 值类型: string, number, boolean, json, array
  category    String    // 分类: storage, system, upload, notification
  label       String    // 显示名称
  description String?   // 配置说明
  isPublic    Boolean   @default(false) // 是否公开（前端可访问）
  isRequired  Boolean   @default(false) // 是否必填
  defaultValue String?  @db.Text // 默认值
  options     String?   @db.Text // 可选项（JSON数组）
  sort        Int       @default(0) // 排序
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@map("configs")
}
```

### 2. 字典表 (dictionary)

用于存储枚举值、下拉选项等。

```prisma
model Dictionary {
  id          Int       @id @default(autoincrement())
  code        String    // 字典编码，如 'storage_type'
  parentId    Int?      // 父级ID，支持树形结构
  label       String    // 显示名称
  value       String    // 值
  type        String    // 类型: enum, tree, list
  sort        Int       @default(0)
  isEnabled   Boolean   @default(true)
  description String?
  extra       String?   @db.Text // 扩展字段（JSON）
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  parent      Dictionary? @relation("DictionaryTree", fields: [parentId], references: [id])
  children    Dictionary[] @relation("DictionaryTree")
  
  @@unique([code, value])
  @@map("dictionaries")
}
```

---

## 配置项示例

### COS 存储配置

```typescript
const cosConfigs = [
  {
    key: 'storage.type',
    value: 'cos', // 'local' | 'cos' | 'oss'
    type: 'enum',
    category: 'storage',
    label: '存储类型',
    description: '选择文件存储方式',
    isPublic: false,
    options: JSON.stringify([
      { label: '本地存储', value: 'local' },
      { label: '腾讯云COS', value: 'cos' },
      { label: '阿里云OSS', value: 'oss' },
    ]),
  },
  {
    key: 'storage.cos.secretId',
    value: '',
    type: 'string',
    category: 'storage',
    label: 'COS SecretId',
    description: '腾讯云 COS SecretId',
    isPublic: false,
    isRequired: true,
  },
  {
    key: 'storage.cos.secretKey',
    value: '',
    type: 'password', // 特殊类型，UI显示为密码框
    category: 'storage',
    label: 'COS SecretKey',
    isPublic: false,
    isRequired: true,
  },
  {
    key: 'storage.cos.bucket',
    value: '',
    type: 'string',
    category: 'storage',
    label: 'COS Bucket',
    isPublic: false,
  },
  {
    key: 'storage.cos.region',
    value: 'ap-guangzhou',
    type: 'string',
    category: 'storage',
    label: 'COS Region',
    isPublic: false,
  },
];
```

---

## 后端实现

### 1. ConfigService

```typescript
// apps/backend/src/modules/config/config.service.ts

@Injectable()
export class ConfigService {
  private configCache = new Map<string, any>();
  
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    this.loadConfigs();
  }
  
  /**
   * 加载所有配置到缓存
   */
  private async loadConfigs() {
    const configs = await this.prisma.config.findMany();
    for (const config of configs) {
      this.configCache.set(config.key, this.parseValue(config));
    }
  }
  
  /**
   * 获取配置值
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    // 1. 从内存缓存读取
    if (this.configCache.has(key)) {
      return this.configCache.get(key) as T;
    }
    
    // 2. 从 Redis 读取
    const redisValue = await this.redis.get(`config:${key}`);
    if (redisValue) {
      const value = JSON.parse(redisValue);
      this.configCache.set(key, value);
      return value as T;
    }
    
    // 3. 从数据库读取
    const config = await this.prisma.config.findUnique({ where: { key } });
    if (config) {
      const value = this.parseValue(config);
      this.configCache.set(key, value);
      await this.redis.set(`config:${key}`, JSON.stringify(value), 3600);
      return value as T;
    }
    
    // 4. 返回默认值
    return defaultValue as T;
  }
  
  /**
   * 设置配置值
   */
  async set(key: string, value: any): Promise<void> {
    const config = await this.prisma.config.findUnique({ where: { key } });
    
    if (config) {
      await this.prisma.config.update({
        where: { key },
        data: { value: JSON.stringify(value) },
      });
    } else {
      await this.prisma.config.create({
        data: {
          key,
          value: JSON.stringify(value),
          type: typeof value,
          category: key.split('.')[0],
          label: key,
        },
      });
    }
    
    // 更新缓存
    this.configCache.set(key, value);
    await this.redis.set(`config:${key}`, JSON.stringify(value), 3600);
    
    // 发布配置变更事件
    await this.redis.publish('config:changed', JSON.stringify({ key, value }));
  }
  
  /**
   * 获取分类配置
   */
  async getByCategory(category: string) {
    const configs = await this.prisma.config.findMany({
      where: { category },
      orderBy: { sort: 'asc' },
    });
    
    return configs.map(config => ({
      ...config,
      value: this.parseValue(config),
    }));
  }
  
  /**
   * 解析配置值
   */
  private parseValue(config: any): any {
    try {
      const value = JSON.parse(config.value);
      
      switch (config.type) {
        case 'number':
          return Number(value);
        case 'boolean':
          return Boolean(value);
        case 'json':
        case 'array':
          return value;
        default:
          return String(value);
      }
    } catch {
      return config.value;
    }
  }
}
```

### 2. UploadService 改造

```typescript
// apps/backend/src/modules/upload/upload.service.ts

@Injectable()
export class UploadService {
  constructor(
    private configService: ConfigService,
  ) {}
  
  async uploadImage(file: Express.Multer.File): Promise<UploadResult> {
    // 从配置服务获取存储类型
    const storageType = await this.configService.get<string>('storage.type', 'local');
    
    switch (storageType) {
      case 'cos':
        return this.uploadToCOS(file);
      case 'oss':
        return this.uploadToOSS(file);
      case 'local':
      default:
        return this.uploadToLocal(file);
    }
  }
  
  private async uploadToCOS(file: Express.Multer.File): Promise<UploadResult> {
    // 动态获取 COS 配置
    const secretId = await this.configService.get<string>('storage.cos.secretId');
    const secretKey = await this.configService.get<string>('storage.cos.secretKey');
    const bucket = await this.configService.get<string>('storage.cos.bucket');
    const region = await this.configService.get<string>('storage.cos.region');
    
    if (!secretId || !secretKey || !bucket) {
      throw new BadRequestException('COS 配置不完整');
    }
    
    // 上传到 COS
    // ...
  }
}
```

---

## 后台管理界面

### 1. 配置管理页面

```typescript
// apps/admin/src/pages/system/config/index.tsx

export default function ConfigManage() {
  const [category, setCategory] = useState('storage');
  const { data: configs, refetch } = useQuery(['configs', category], () =>
    api.get(`/api/config?category=${category}`)
  );
  
  const handleSave = async (key: string, value: any) => {
    await api.post('/api/config', { key, value });
    refetch();
    message.success('保存成功');
  };
  
  return (
    <Card title="系统配置">
      <Tabs activeKey={category} onChange={setCategory}>
        <TabPane tab="存储配置" key="storage" />
        <TabPane tab="系统配置" key="system" />
        <TabPane tab="上传配置" key="upload" />
      </Tabs>
      
      <Form>
        {configs?.map(config => (
          <Form.Item
            key={config.key}
            label={config.label}
            tooltip={config.description}
            required={config.isRequired}
          >
            {renderFormItem(config, handleSave)}
          </Form.Item>
        ))}
      </Form>
    </Card>
  );
}
```

---

## 优势

### 1. 灵活性
- ✅ 新增配置项无需修改表结构
- ✅ 支持多种数据类型
- ✅ 支持复杂配置（JSON、数组）

### 2. 可维护性
- ✅ 配置集中管理
- ✅ 可视化配置界面
- ✅ 配置变更无需重启

### 3. 安全性
- ✅ 敏感配置加密存储
- ✅ 权限控制（isPublic）
- ✅ 配置变更日志

### 4. 性能
- ✅ 三级缓存（内存 → Redis → 数据库）
- ✅ 配置变更事件推送
- ✅ 按需加载

---

## 实施计划

### Phase 1: 数据库和基础服务（1-2天）
1. 创建 Prisma Schema
2. 实现 ConfigService
3. 实现 DictionaryService
4. 编写单元测试

### Phase 2: 后端API（1天）
1. ConfigController
2. 权限控制
3. 配置变更事件

### Phase 3: 前端管理界面（2天）
1. 配置管理页面
2. 字典管理页面
3. 表单渲染逻辑

### Phase 4: 迁移现有配置（1天）
1. 迁移环境变量到配置表
2. 更新相关服务
3. 回归测试

---

## 配置项规划

### 存储配置 (storage)
- `storage.type` - 存储类型
- `storage.cos.*` - COS 配置
- `storage.oss.*` - OSS 配置
- `storage.local.path` - 本地存储路径

### 上传配置 (upload)
- `upload.maxSize` - 最大文件大小
- `upload.allowedTypes` - 允许的文件类型
- `upload.imageQuality` - 图片压缩质量

### 系统配置 (system)
- `system.siteName` - 网站名称
- `system.logo` - Logo URL
- `system.icp` - 备案号
- `system.keywords` - SEO关键词

### 通知配置 (notification)
- `notification.email.enabled` - 邮件通知开关
- `notification.sms.enabled` - 短信通知开关
- `notification.push.enabled` - 推送通知开关

---

**文档版本**: 1.0  
**创建时间**: 2024-11-24  
**作者**: AI Assistant
