# 📋 文档清理指导原则

## 🚨 **严禁删除的核心文档目录**

### 🏗️ **项目架构文档** - **绝对不能删除**
```
docs/architecture/              # VitePress 架构文档站点
├── .vitepress/                # VitePress 配置和缓存
├── README.md                  # 架构文档主入口
├── architecture/              # 架构设计文档
├── packages/                  # 各包架构文档  
├── getting-started/           # 快速开始指南
├── deployment/                # 部署文档
├── backend/                   # 后端架构
└── tools/                     # 工具文档
```

### 🎨 **设计系统文档** - **绝对不能删除**
```
docs/design-prompts/           # 设计系统和页面设计
├── README.md                  # 设计系统总览
├── design-theme.md            # 设计主题规范
├── 01-login-page.md           # 各页面设计指南
├── 02-index-page.md
├── 03-detail-page.md
├── 04-publish-page.md
├── 05-category-page.md
└── 06-mine-page.md
```

### 📖 **开发指南文档** - **绝对不能删除**  
```
docs/guides/                   # 开发指南和最佳实践
├── CONTENT_CLASSIFICATION_GUIDE.md
├── CURSOR_PAGINATION_GUIDE.md  
├── RESPONSE_STRUCTURE_GUIDE.md
├── RESPONSE_FORMAT_COMPARISON.md
└── ssr-auth.md
```

### 📱 **移动端文档** - **绝对不能删除**
```
apps/mobile/docs/              # 移动端开发规范
├── design-scale-standard.md   # 1.7倍缩放标准  
├── how-to-use-design-scale.md
├── SYSTEM_CONFIG_USAGE.md
├── detail-page-scss-reference.scss
├── mine-page-scss-reference.scss
└── publish-page-scss-reference.scss
```

### 📝 **核心规范文档** - **绝对不能删除**
```
docs/
├── CODING_STANDARDS.md       # 编码规范
├── UI_DESIGN_SYSTEM.md       # UI设计系统  
├── SHARED-HOOKS-GUIDE.md     # Hooks使用指南
├── DICTIONARY_MODULE_GUIDE.md # 字典模块
├── MIAODUO_GUIDE.md          # 设计稿集成
├── CONFIG_SYSTEM_DESIGN.md   # 配置系统设计
├── PERFORMANCE-OPTIMIZATION.md # 性能优化
├── DATABASE-MIGRATION-GUIDE.md # 数据库迁移
├── STORAGE-STRATEGY.md       # 存储策略
├── SMART-UPLOAD-GUIDE.md     # 智能上传
├── Taro组件库最佳实践.md     # Taro开发规范
└── UI组件库设计文档.md       # UI组件设计
```

## ✅ **可以清理的文档类型**

### 🗑️ **允许删除的文档**
- `docs/**/TEMP_*.md` - 临时文档
- `docs/**/DRAFT_*.md` - 草稿文档  
- `docs/**/OLD_*.md` - 过时文档
- `docs/**/BACKUP_*.md` - 备份文档
- `docs/**/*.bak` - 备份文件
- `docs/**/.DS_Store` - 系统文件

### ⚠️ **需要谨慎评估的文档**
- 单独的API文档（需要检查是否被architecture/引用）
- 重复的技术文档（确认无architecture/依赖后可删）
- 过时的配置文档（确认不影响当前配置系统）

## 🔍 **清理前检查清单**

### ✅ **必须执行的检查**
1. **检查VitePress依赖**
   ```bash
   cd docs/architecture
   npm run build  # 确保构建成功
   ```

2. **检查内部链接**
   ```bash
   grep -r "\[.*\](\./" docs/
   # 确保没有破坏的内部链接
   ```

3. **检查模板项目引用**  
   ```bash
   find packages/*/templates -name "*.md" -o -name "*.json" | xargs grep -l "docs/"
   # 确保模板不依赖要删除的文档
   ```

4. **检查README索引**
   ```bash
   grep -n "\[.*\](" docs/README.md
   # 确保主README的所有链接有效
   ```

## 🚨 **紧急恢复措施**

### 如果误删重要文档：
```bash
# 1. 立即停止清理操作
git status

# 2. 从上一次提交恢复
git checkout HEAD~1 -- docs/architecture/
git checkout HEAD~1 -- docs/design-prompts/  
git checkout HEAD~1 -- docs/guides/

# 3. 从特定提交恢复（如果需要）
git checkout f6a3b90 -- docs/

# 4. 查看恢复的文件
git status
```

## 📋 **标准清理流程**

### 1. **准备阶段**
```bash
# 创建清理分支
git checkout -b doc-cleanup-$(date +%Y%m%d)

# 备份当前状态
git tag backup-before-cleanup
```

### 2. **安全清理**
```bash
# 只删除明确的临时文件
find docs/ -name "TEMP_*" -delete
find docs/ -name "DRAFT_*" -delete  
find docs/ -name "*.bak" -delete
find docs/ -name ".DS_Store" -delete
```

### 3. **验证阶段**
```bash
# 验证架构文档
cd docs/architecture && npm run build

# 验证主文档链接
cd ../.. && grep -r "\[.*\](" docs/README.md

# 验证模板完整性
find packages/*/templates -name "*.tpl" | wc -l
```

### 4. **提交阶段**
```bash
git add .
git commit -m "docs: safe cleanup - remove only temp/draft files"
```

## 🎯 **文档维护最佳实践**

### ✅ **推荐做法**
- 新建临时文档使用 `TEMP_` 前缀
- 草稿文档使用 `DRAFT_` 前缀  
- 重构前先备份为 `BACKUP_` 前缀
- 删除前使用 `git tag` 创建备份点
- 大规模清理前创建专门分支

### ❌ **严禁操作**
- 批量删除 `docs/` 目录
- 删除 `.vitepress/` 配置
- 删除任何 `README.md` 主文档
- 删除设计系统相关文档
- 删除移动端规范文档

---

**本指南最后更新**: 2024-12-23  
**适用版本**: SVTON v1.0.0+  
**负责维护**: 项目架构组
