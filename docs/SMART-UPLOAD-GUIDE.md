# 智能上传方案使用指南

## 🎯 核心特性

### 业务代码统一，上传方式自动切换

```typescript
// 业务代码始终一致
import { uploadImage } from '@/services/upload.service';

const result = await uploadImage(filePath);
console.log(result.url); // 图片URL

// 内部自动判断：
// - 本地存储 → 后端中转
// - COS + auto模式 → 前端直传
// - COS + proxy模式 → 后端中转
```

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────┐
│        业务代码（统一接口）              │
│   uploadImage(file) → { url }          │
└──────────────┬──────────────────────────┘
               │
         获取上传配置
               │
        ┌──────▼──────┐
        │  判断模式    │
        └──────┬──────┘
               │
      ┌────────┴────────┐
      │                 │
┌─────▼──────┐  ┌───────▼────────┐
│ 前端直传COS │  │  后端中转上传  │
│  (快速)    │  │  (兼容/安全)   │
└────────────┘  └────────────────┘
```

---

## 📦 安装依赖

### 后端依赖

```bash
cd apps/backend
pnpm install cos-nodejs-sdk-v5 qcloud-cos-sts
```

### 前端依赖

```bash
cd apps/mobile
pnpm install cos-wx-sdk-v5
```

---

## ⚙️ 配置说明

### 环境变量（apps/backend/.env）

```env
# 存储类型
STORAGE_TYPE=cos  # local | cos | oss

# 上传模式（新增）
UPLOAD_MODE=auto  # auto | direct | proxy

# COS 配置
COS_SECRET_ID=AKIDxxxxx
COS_SECRET_KEY=xxxxxxxx
COS_BUCKET=your-bucket-1234567890
COS_REGION=ap-guangzhou
COS_DOMAIN=https://cdn.yourdomain.com
COS_PREFIX=uploads
```

### 上传模式说明

| 模式             | 说明                                | 适用场景           |
| ---------------- | ----------------------------------- | ------------------ |
| **auto**（推荐） | 自动选择：COS使用直传，其他使用中转 | 生产环境，自动优化 |
| **direct**       | 强制前端直传（仅COS）               | 追求极致速度       |
| **proxy**        | 强制后端中转                        | 需要后端处理或验证 |

---

## 🚀 使用方式

### 前端业务代码

```typescript
import { uploadImage, uploadImages } from '@/services/upload.service';
import { chooseImage } from '@/utils/upload';

// 示例1：上传单张图片
async function handleUploadAvatar() {
  try {
    // 1. 选择图片
    const filePaths = await chooseImage(1);

    // 2. 上传（自动选择方式）
    const result = await uploadImage(filePaths[0], (progress) => {
      console.log(`上传进度：${progress}%`);
    });

    // 3. 使用图片URL
    console.log('图片URL:', result.url);
    // 保存到数据库或显示
  } catch (error) {
    Taro.showToast({ title: '上传失败', icon: 'none' });
  }
}

// 示例2：批量上传图片
async function handleUploadMultiple() {
  try {
    // 1. 选择多张图片
    const filePaths = await chooseImage(9);

    // 2. 批量上传
    const results = await uploadImages(filePaths, (current, total) => {
      console.log(`上传进度：${current}/${total}`);
      Taro.showLoading({ title: `上传中 ${current}/${total}` });
    });

    Taro.hideLoading();

    // 3. 获取所有URL
    const urls = results.map(r => r.url);
    console.log('所有图片URL:', urls);
  } catch (error) {
    Taro.hideLoading();
    Taro.showToast({ title: '上传失败', icon: 'none' });
  }
}

// 示例3：在表单中使用
function PublishPostForm() {
  const [coverImage, setCoverImage] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    setUploading(true);
    try {
      const filePaths = await chooseImage(1);
      const result = await uploadImage(filePaths[0]);
      setCoverImage(result.url);
      Taro.showToast({ title: '上传成功', icon: 'success' });
    } catch (error) {
      Taro.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <Button onClick={handleUpload} loading={uploading}>
        选择封面
      </Button>
      {coverImage && <Image src={coverImage} />}
    </View>
  );
}
```

### API 说明

#### `uploadImage(filePath, onProgress?)`

上传单张图片

**参数**：

- `filePath`: string - 本地文件路径
- `onProgress?`: (progress: number) => void - 进度回调（0-100）

**返回**：

```typescript
{
  url: string;  // 图片访问URL
  key?: string; // COS key（前端直传时返回）
}
```

#### `uploadImages(filePaths, onProgress?)`

批量上传图片

**参数**：

- `filePaths`: string[] - 本地文件路径数组
- `onProgress?`: (current: number, total: number) => void - 进度回调

**返回**：

```typescript
Array<{
  url: string;
  key?: string;
}>;
```

---

## 🔄 工作流程

### 流程 1：前端直传 COS（auto 模式 + COS）

```
1. 前端调用 uploadImage(file)
   ↓
2. 请求 GET /api/upload/config
   返回：{ mode: 'direct', cosConfig: {...} }
   ↓
3. 请求 POST /api/upload/signature
   返回：临时签名（30分钟有效）
   ↓
4. 使用临时签名直传到 COS
   ↓
5. 返回 COS URL
```

**优势**：

- ✅ 快（不经过后端）
- ✅ 省后端带宽
- ✅ 临时签名安全

### 流程 2：后端中转（proxy 模式或本地存储）

```
1. 前端调用 uploadImage(file)
   ↓
2. 请求 GET /api/upload/config
   返回：{ mode: 'proxy' }
   ↓
3. 直接上传到 POST /api/upload/image
   ↓
4. 后端保存到本地或上传到 COS
   ↓
5. 返回图片 URL
```

**优势**：

- ✅ 兼容所有存储
- ✅ 可以预处理
- ✅ 统一验证

---

## 📊 方案对比

| 特性           | 前端直传 COS    | 后端中转      |
| -------------- | --------------- | ------------- |
| **速度**       | ⭐⭐⭐⭐⭐ 最快 | ⭐⭐⭐ 一般   |
| **后端带宽**   | 不占用          | 占用          |
| **兼容性**     | 仅 COS          | 全部          |
| **安全性**     | 临时签名        | 后端验证      |
| **前端复杂度** | 自动处理        | 自动处理      |
| **适用场景**   | 生产环境 COS    | 开发/其他存储 |

**推荐配置**：

```env
# 生产环境
STORAGE_TYPE=cos
UPLOAD_MODE=auto  ← 自动优化
```

---

## 🔒 安全机制

### 1. 临时签名（前端直传）

```typescript
// 后端生成临时签名（30分钟有效）
{
  tmpSecretId: 'AKIDxxxx',
  tmpSecretKey: 'xxxx',
  sessionToken: 'token',
  expiration: 1234567890,
  key: 'uploads/xxx.jpg'  // 只能上传这个文件
}
```

**安全特点**：

- ✅ 临时密钥，30分钟后失效
- ✅ 权限限制，只能上传指定文件
- ✅ 永久密钥不暴露

### 2. 后端验证（中转上传）

```typescript
// 后端验证
- 文件类型：只允许图片
- 文件大小：< 5MB
- 用户权限：可扩展
```

---

## 🎨 高级功能

### 自定义上传配置

```typescript
import { uploadService } from '@/services/upload.service';

// 刷新配置（切换上传方式后）
await uploadService.refreshConfig();

// 获取当前模式
const mode = await uploadService.getCurrentMode();
console.log('当前上传模式:', mode); // 'direct' | 'proxy'
```

### 图片处理（COS）

前端直传到 COS 后，可以通过 URL 参数处理图片：

```typescript
const imageUrl = result.url;

// 缩略图
const thumbnail = `${imageUrl}?imageMogr2/thumbnail/200x200`;

// 压缩
const compressed = `${imageUrl}?imageMogr2/quality/80`;

// WebP 格式
const webp = `${imageUrl}?imageMogr2/format/webp`;

// 组合处理
const optimized = `${imageUrl}?imageMogr2/thumbnail/200x200/quality/80/format/webp`;
```

---

## 🐛 故障处理

### 自动降级

前端上传服务内置降级机制：

```typescript
// 如果前端直传失败，自动降级为后端中转
try {
  return await this.uploadDirect(file); // 尝试直传
} catch (error) {
  console.warn('直传失败，降级为后端中转');
  return await this.uploadProxy(file); // 降级
}
```

### 配置获取失败

```typescript
// 如果无法获取配置，默认使用后端中转
try {
  const config = await fetchUploadConfig();
} catch (error) {
  console.warn('获取配置失败，使用默认配置');
  return { mode: 'proxy' }; // 降级
}
```

---

## 📝 最佳实践

### 1. 开发环境

```env
# 本地开发
STORAGE_TYPE=local
UPLOAD_MODE=proxy

# 优势：
# - 无需配置 COS
# - 快速启动
# - 零成本
```

### 2. 生产环境

```env
# 生产部署
STORAGE_TYPE=cos
UPLOAD_MODE=auto

# 优势：
# - COS 自动直传（快）
# - 节省后端带宽
# - 自动降级保底
```

### 3. 特殊场景

```env
# 需要后端处理图片
UPLOAD_MODE=proxy

# 场景：
# - 图片水印
# - 内容审核
# - 格式转换
```

---

## 🚦 测试验证

### 测试前端直传

```bash
# 1. 配置 COS
STORAGE_TYPE=cos
UPLOAD_MODE=direct

# 2. 重启后端
cd apps/backend && pnpm dev

# 3. 上传图片，查看日志
# 应该看到：
# - 请求 /api/upload/config → { mode: 'direct' }
# - 请求 /api/upload/signature → 临时签名
# - 直接上传到 COS
```

### 测试后端中转

```bash
# 1. 配置中转
UPLOAD_MODE=proxy

# 2. 重启后端

# 3. 上传图片，查看日志
# 应该看到：
# - 请求 /api/upload/config → { mode: 'proxy' }
# - 请求 /api/upload/image → 上传文件
```

### 测试自动切换

```bash
# 1. 先配置 COS + auto
STORAGE_TYPE=cos
UPLOAD_MODE=auto

# 2. 上传图片 → 应该使用直传

# 3. 改为本地存储
STORAGE_TYPE=local

# 4. 刷新配置
await uploadService.refreshConfig();

# 5. 再上传 → 应该使用中转
```

---

## 💰 成本优化

### 流量成本对比

**后端中转**：

```
用户 → 服务器：消耗用户流量
服务器 → COS：消耗服务器流量（计费）

100 张图片 × 500KB = 50MB
服务器流量成本：50MB × 2 = 100MB
```

**前端直传**：

```
用户 → COS：直接上传（不经过服务器）

100 张图片 × 500KB = 50MB
服务器流量成本：0MB  ✅
```

**每月节省**（100用户，每人10张图）：

```
后端中转：100 × 10 × 500KB × 2 = 1GB
前端直传：0GB

节省流量费：1GB × 0.8元 = 0.8元/月
年节省：约 10元
```

虽然金额不大，但**用户体验提升明显**！

---

## 🎯 总结

### 核心优势

1. **业务代码零改动**

   ```typescript
   // 始终一行代码
   const result = await uploadImage(file);
   ```

2. **自动选择最优方案**
   - COS → 前端直传（快）
   - 其他 → 后端中转（稳）

3. **完整的降级机制**
   - 配置获取失败 → 降级中转
   - 直传失败 → 降级中转
   - 保证上传成功率

4. **灵活的配置**
   - 一个环境变量切换模式
   - 无需修改代码

### 立即使用

```bash
# 1. 安装依赖
cd apps/backend && pnpm install
cd apps/mobile && pnpm install

# 2. 配置环境变量
STORAGE_TYPE=cos
UPLOAD_MODE=auto

# 3. 在业务代码中使用
import { uploadImage } from '@/services/upload.service';
const result = await uploadImage(filePath);

# ✅ 完成！
```

---

**智能、灵活、易用的上传方案！** 🚀

**文档版本**：v1.0  
**最后更新**：2025-11-23
