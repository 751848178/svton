# 图片存储策略文档

## 📊 存储方案对比

### 当前方案：本地存储

**容量评估**：

- 服务器可用：50GB
- 单张图片平均：300KB
- 可存储图片：约 170,000 张
- 支持用户规模：500-1000 人（中等活跃度）

### 升级方案：对象存储（COS/OSS）

**推荐时机**：

- 注册用户 > 500
- 每日新增内容 > 50 条
- 存储使用 > 30GB
- 图片加载速度成为瓶颈

---

## 🏗️ 架构设计（支持平滑迁移）

### 策略模式设计

```
┌────────────────────────────────────┐
│     Upload Service (统一接口)      │
└──────────────┬─────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│ Local       │  │   COS       │
│ Storage     │  │  Storage    │
└─────────────┘  └─────────────┘
```

### 环境变量配置

```env
# 存储策略选择
STORAGE_TYPE=local  # local | cos | oss

# 本地存储配置
UPLOAD_DIR=./uploads

# 腾讯云 COS 配置
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou
COS_DOMAIN=https://your-bucket.cos.ap-guangzhou.myqcloud.com

# 阿里云 OSS 配置（备选）
OSS_ACCESS_KEY_ID=your-key
OSS_ACCESS_KEY_SECRET=your-secret
OSS_BUCKET=your-bucket
OSS_REGION=oss-cn-shenzhen
```

---

## 💰 成本分析

### 本地存储成本

```
服务器存储：已包含
额外带宽：0 元（初期）
CDN：无
图片处理：无

月成本：0 元
年成本：0 元
```

### 腾讯云 COS 成本（推荐）

**标准存储**：

```
50GB × 0.099 元/GB/月 = 4.95 元/月

年成本：59.4 元
```

**CDN 流量**（按 100GB/月 估算）：

```
0-2TB：0.21 元/GB
100GB × 0.21 = 21 元/月

年成本：252 元
```

**图片处理**：

```
基础处理（缩略图、裁剪、旋转）：免费
高级处理（AI识别）：按量计费

月成本：0-10 元
```

**总计**：

```
存储：60 元/年
流量：250 元/年
处理：100 元/年
━━━━━━━━━━━━
合计：约 400-500 元/年
```

### 阿里云 OSS 成本

与腾讯云类似，略高 10-20%

---

## 📈 存储增长预测

### 用户规模 vs 存储需求

| 活跃用户 | 月新增内容 | 月增存储 | 年度存储 | 50GB支持时长 |
| -------- | ---------- | -------- | -------- | ------------ |
| 100      | 500        | 450MB    | 5.4GB    | 9 年 ✅      |
| 500      | 2,500      | 2.25GB   | 27GB     | 1.8 年 ✅    |
| 1,000    | 5,000      | 4.5GB    | 54GB     | 11 个月 ⚠️   |
| 2,000    | 10,000     | 9GB      | 108GB    | 5 个月 ❌    |
| 5,000    | 25,000     | 22.5GB   | 270GB    | 2 个月 ❌    |

**结论**：

- ✅ 500 用户以内：本地存储完全够用
- ⚠️ 500-1000 用户：开始考虑迁移
- ❌ 1000+ 用户：必须使用对象存储

---

## 🎯 分阶段策略

### 阶段 1：MVP 测试期（当前）

**目标**：快速验证产品

**存储方案**：本地存储

- 成本：0 元
- 支持规模：< 500 用户
- 评估周期：2-4 周

**监控指标**：

```bash
# 监控磁盘使用
df -h

# 监控上传目录大小
du -sh ./uploads

# 监控图片数量
find ./uploads -type f | wc -l
```

**告警阈值**：

- 存储使用 > 30GB（60%）
- 每日新增 > 1GB
- 磁盘 IO 等待 > 10%

---

### 阶段 2：正式发布期

**触发条件**（满足任一）：

- 注册用户 > 500
- 月新增内容 > 2,000
- 存储使用 > 30GB
- 用户反馈加载慢

**存储方案**：迁移到腾讯云 COS

**迁移步骤**：

1. 申请腾讯云账号
2. 创建 COS 存储桶
3. 配置 CDN 加速
4. 开发 COS 存储适配器
5. 新图片上传到 COS
6. 历史图片批量迁移（可选）

**预估工作量**：2-3 天

---

### 阶段 3：规模化运营期

**用户规模**：> 2,000

**优化措施**：

1. **CDN 优化**
   - 自定义加速域名
   - 配置防盗链
   - 启用 HTTPS

2. **图片处理**
   - 自动生成多种尺寸缩略图
   - 智能压缩（降低流量成本）
   - WebP 格式转换（节省 30% 流量）

3. **成本优化**
   - 低频访问图片转为低频存储（便宜 40%）
   - 长期不访问图片转为归档存储（便宜 80%）
   - 定期清理无效图片

---

## 🔄 迁移方案设计

### 平滑迁移策略

```typescript
// 上传服务接口设计
interface IStorageService {
  upload(file: File): Promise<string>;
  delete(url: string): Promise<void>;
  getUrl(key: string): string;
}

// 本地存储实现
class LocalStorage implements IStorageService {
  async upload(file: File) {
    // 保存到本地
    return '/uploads/xxx.jpg';
  }
}

// COS 存储实现
class COSStorage implements IStorageService {
  async upload(file: File) {
    // 上传到 COS
    return 'https://xxx.cos.ap-guangzhou.myqcloud.com/xxx.jpg';
  }
}

// 工厂模式选择
class StorageFactory {
  static create(type: string): IStorageService {
    switch (type) {
      case 'local':
        return new LocalStorage();
      case 'cos':
        return new COSStorage();
      default:
        return new LocalStorage();
    }
  }
}
```

### 历史数据迁移

```bash
# 批量上传到 COS
npm install -g coscmd

# 配置
coscmd config -a <SecretId> -s <SecretKey> \
  -b <BucketName-APPID> -r <Region>

# 批量上传
coscmd upload -r ./uploads /uploads

# 验证
coscmd list /uploads
```

---

## 📊 监控和告警

### 存储监控脚本

```bash
#!/bin/bash
# storage-monitor.sh

UPLOAD_DIR="./uploads"
THRESHOLD_GB=30

# 获取目录大小（GB）
SIZE=$(du -s "$UPLOAD_DIR" | awk '{print $1/1024/1024}')

echo "当前存储使用: ${SIZE}GB / 50GB"

if (( $(echo "$SIZE > $THRESHOLD_GB" | bc -l) )); then
  echo "⚠️  警告：存储使用超过 ${THRESHOLD_GB}GB"
  echo "建议：考虑迁移到对象存储"
fi

# 统计图片数量
COUNT=$(find "$UPLOAD_DIR" -type f | wc -l)
echo "图片总数: $COUNT"

# 计算增长速率
if [ -f /tmp/last_count ]; then
  LAST=$(cat /tmp/last_count)
  GROWTH=$((COUNT - LAST))
  echo "今日新增: $GROWTH 张"
fi

echo "$COUNT" > /tmp/last_count
```

### 定时任务

```bash
# 每天凌晨 2 点执行监控
crontab -e
0 2 * * * /path/to/storage-monitor.sh >> /var/log/storage-monitor.log 2>&1
```

---

## 🎨 图片处理优化

### COS 图片处理示例

```
原图：
https://xxx.cos.ap-guangzhou.myqcloud.com/photo.jpg

缩略图（200x200）：
https://xxx.cos.ap-guangzhou.myqcloud.com/photo.jpg?imageMogr2/thumbnail/200x200

压缩（质量 80%）：
https://xxx.cos.ap-guangzhou.myqcloud.com/photo.jpg?imageMogr2/quality/80

格式转换（WebP）：
https://xxx.cos.ap-guangzhou.myqcloud.com/photo.jpg?imageMogr2/format/webp

组合处理（缩略+压缩+格式）：
https://xxx.cos.ap-guangzhou.myqcloud.com/photo.jpg?imageMogr2/thumbnail/200x200/quality/80/format/webp
```

### 前端自动适配

```typescript
// 根据设备生成合适尺寸
function getImageUrl(url: string, width: number) {
  if (url.includes('.cos.')) {
    // COS 图片，自动处理
    return `${url}?imageMogr2/thumbnail/${width}x/quality/85/format/webp`
  }
  // 本地图片，直接返回
  return url
}

// 使用
<Image src={getImageUrl(coverImage, 750)} />
```

---

## 🎯 决策建议

### 立即行动

✅ **保持本地存储**（当前阶段合适）
✅ **设计可扩展架构**（预留切换能力）
✅ **监控存储使用**（设置告警）

### 3-6 个月内

⏳ **评估用户增长**
⏳ **监控存储压力**
⏳ **准备迁移方案**

### 触发迁移

🚨 **存储使用 > 30GB**
🚨 **用户数 > 500**
🚨 **图片加载慢**

---

## 📞 技术支持

### 腾讯云 COS

- 官方文档：https://cloud.tencent.com/document/product/436
- SDK 文档：https://cloud.tencent.com/document/product/436/8629
- 价格计算器：https://buy.cloud.tencent.com/price/cos

### 阿里云 OSS

- 官方文档：https://help.aliyun.com/product/31815.html
- SDK 文档：https://help.aliyun.com/document_detail/32068.html

---

## 📋 总结

**当前阶段（MVP）**：

- ✅ 使用本地存储
- ✅ 成本为 0
- ✅ 支持 500-1000 用户

**升级阈值**：

- 用户 > 500
- 存储 > 30GB
- 加载速度慢

**升级后收益**：

- CDN 加速（快 4-10 倍）
- 图片处理（自动缩略图）
- 成本可控（约 400-500 元/年）

**建议**：
📊 监控存储使用
🏗️ 设计可扩展架构
⏰ 在合适时机迁移

---

**文档版本**：v1.0  
**最后更新**：2025-11-22
