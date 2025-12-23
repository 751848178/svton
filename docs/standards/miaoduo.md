# 妙多设计系统使用指南

> 基于妙多 AI 设计工具构建「社区助手」小程序设计系统

---

## 🎯 设计系统概览

### 妙多四大样式类型

#### 1. 颜色样式 (Color Styles)

- 主色: #1890FF (品牌蓝)
- 渐变: linear-gradient(135deg, #1890FF, #0077FF)
- 中性色: #1A1A1A / #333333 / #666666 / #8A8A8A / #AAAAAA
- 背景色: #F7F8FA / #FFFFFF / #F0F0F0

#### 2. 文本样式 (Text Styles)

- H1 标题: 36px, 字重 600
- H2 标题: 32px, 字重 600
- H3 标题: 30px, 字重 600
- Body: 28px/26px/24px, 字重 400
- Caption: 22px, 字重 400

#### 3. 效果样式 (Effect Styles)

- Shadow/Light: 0 2px 8px rgba(0,0,0,0.04)
- Shadow/Medium: 0 2px 12px rgba(0,0,0,0.08)
- Shadow/Strong: 0 4px 16px rgba(0,0,0,0.12)
- Shadow/Button: 0 4px 12px rgba(24,144,255,0.3)

#### 4. 布局网格样式 (Layout Grid Styles)

- 基础单位: 8px
- 页面网格: 8px × 8px
- 内边距网格: 16px / 24px / 32px

---

## 📦 在妙多中创建样式

### Step 1: 创建颜色样式

```
文件 → 样式 → 创建颜色样式

样式列表:
├─ Primary/Brand Blue (#1890FF)
├─ Primary/Gradient (渐变)
├─ Text/Title (#1A1A1A)
├─ Text/Body (#333333)
├─ Text/Secondary (#666666)
├─ Text/Auxiliary (#8A8A8A)
├─ Text/Placeholder (#AAAAAA)
├─ Background/Page (#F7F8FA)
├─ Background/Card (#FFFFFF)
└─ Border/Default (#F0F0F0)
```

### Step 2: 创建文本样式

```
文件 → 样式 → 创建文本样式

样式列表:
├─ Heading/H1 (36px, 600)
├─ Heading/H2 (32px, 600)
├─ Heading/H3 (30px, 600)
├─ Body/Large (28px, 400)
├─ Body/Medium (26px, 400)
├─ Body/Small (24px, 400)
└─ Caption (22px, 400)
```

### Step 3: 创建效果样式

```
文件 → 样式 → 创建效果样式

样式列表:
├─ Shadow/Light
├─ Shadow/Medium
├─ Shadow/Strong
└─ Shadow/Button
```

### Step 4: 创建布局网格样式

```
文件 → 样式 → 创建布局网格样式

网格设置:
- 网格类型: 方形网格
- 网格大小: 8px × 8px
- 颜色: rgba(255, 0, 0, 0.1)
```

---

## 🧩 组件库结构

### 基础组件

```
组件库
├─ Buttons/
│  ├─ Primary Button (主按钮)
│  ├─ Secondary Button (次要按钮)
│  ├─ Text Button (文字按钮)
│  └─ Small Button (小按钮)
├─ Inputs/
│  ├─ Text Input (文本输入框)
│  └─ Textarea (多行输入框)
├─ Tags/
│  ├─ Default Tag (默认标签)
│  └─ Pill Tag (胶囊标签)
├─ Cards/
│  ├─ Standard Card (标准卡片)
│  └─ List Card (列表卡片)
├─ Avatars/
│  ├─ Avatar XL (112px)
│  ├─ Avatar L (96px)
│  ├─ Avatar M (80px)
│  └─ Avatar S (48px)
└─ Icons/
   └─ Icon Container (图标容器)
```

---

## 🎨 使用妙多 AI 生成设计

### 与妙多 AI 对话

#### 生成整页设计

```
提示词:
请基于以下设计系统，设计一个社区小程序的首页：
- 使用品牌蓝 #1890FF 作为主色
- 顶部为 Tab 切换（推荐、关注、最新）
- 内容区为卡片列表，包含：
  - 作者头像和昵称
  - 内容标题和摘要
  - 标签、浏览量、点赞数
- 样式: 简约、现代、温馨
- 圆角: 16px
- 间距: 基于 8px 网格
```

#### 生成组件变体

```
提示词:
请创建一个按钮组件，包含以下变体：
- 类型: Primary / Secondary / Text
- 尺寸: Large / Small
- 状态: Default / Hover / Disabled
- 样式要求:
  - Primary: 渐变蓝色背景，圆角 12px
  - Secondary: 灰色背景，边框 2px
  - 字号: Large 30px, Small 26px
```

#### 生成局部模块

```
提示词:
为社区助手小程序设计一个用户信息卡片：
- 左侧头像 96px，圆形
- 右侧昵称和个性签名
- 底部统计数据（发布/收藏/评论）
- 背景白色，圆角 16px，阴影 Light
- 整体风格温馨友好
```

---

## 📱 页面设计要求

### 登录页

```
布局: 上下分层
- 顶部 Logo 区: 白色背景
- 底部表单区: #F7F8FA 背景
- 输入框: 边框 2px, 圆角 12px
- 登录按钮: 渐变蓝 + 阴影
```

### 首页/列表页

```
布局: Tab + 滚动列表
- Tab 栏高度: 80px
- 卡片间距: 16px
- 卡片圆角: 16px
- 背景: #F5F5F5
```

### 详情页

```
布局: 作者信息 + 内容区
- 作者头像: 96px
- 内容内边距: 32px 28px
- 底部操作栏: 固定，高度 96px
```

### 发布页

```
布局: 分段表单
- Section 间距: 16px
- 内边距: 32px 28px
- 底部操作栏: 固定，2 个按钮
```

### 我的页面

```
布局: 用户信息 + 菜单列表
- 用户信息: 左对齐
- 菜单卡片: 圆角 16px，间距 12px
- 图标容器: 48px，圆角 12px
```

---

## 🔄 设计系统维护

### 使用妙多 AI 设计系统功能

#### 1. 一键生成界面清单

```
选择历史设计稿 → AI 识别 → 生成样式组件清单
```

#### 2. 及时发现新样式

```
AI 自动检测 → 发现未使用样式的组件 → 提醒整合
```

#### 3. 智能检查规范

```
设计师自查 → AI 检查文本、颜色、组件 → 实时反馈
```

### 发布组件库

```
1. 整理所有样式和组件
2. 文件 → 发布组件库
3. 团队成员可直接使用
4. 更新后一键同步
```

---

## ✅ 设计交付清单

### 给到开发的文件

- [ ] 妙多设计源文件 (.miaoduo)
- [ ] 页面设计稿 (PNG @2x @3x)
- [ ] 组件切图资源
- [ ] 图标 SVG 文件
- [ ] 设计标注 (使用妙多标注功能)
- [ ] 设计规范文档

### 设计验收标准

- [ ] 使用了定义的颜色样式
- [ ] 使用了定义的文本样式
- [ ] 使用了定义的效果样式
- [ ] 遵循 8px 网格系统
- [ ] 组件变体完整
- [ ] 交互状态清晰

---

## 🤖 妙多 AI 提示词模板

### 完整项目提示词

```
你是一位资深 UI 设计师，请使用妙多设计工具为"社区助手"小程序创建完整的设计系统。

【项目背景】
社区助手是一款面向社区居民的生活服务小程序，提供邻里互助、信息分享、活动组织等功能。目标用户是 25-45 岁的社区居民，注重实用性和温馨友好的体验。

【设计要求】
1. 品牌调性: 温馨、友好、现代、简约
2. 主色调: #1890FF (社区蓝)
3. 设计尺寸: 375px 宽度
4. 圆角风格: 12-16px
5. 间距系统: 8px 网格

【样式系统】
请创建以下妙多样式:

颜色样式:
- Primary/Brand Blue: #1890FF
- Primary/Gradient: linear-gradient(135deg, #1890FF, #0077FF)
- Text/Title: #1A1A1A
- Text/Body: #333333
- Background/Page: #F7F8FA
- Background/Card: #FFFFFF

文本样式:
- Heading/H1: 36px, 字重 600, 行高 1.2
- Heading/H3: 30px, 字重 600, 行高 1.4
- Body/Large: 28px, 字重 400, 行高 1.6
- Body/Medium: 26px, 字重 400, 行高 1.6

效果样式:
- Shadow/Light: 0 2px 8px rgba(0,0,0,0.04)
- Shadow/Button: 0 4px 12px rgba(24,144,255,0.3)

【组件要求】
请设计以下组件:
1. 按钮 (Primary/Secondary/Text × Large/Small)
2. 输入框 (默认/聚焦/错误状态)
3. 卡片 (内容卡片/列表卡片)
4. 标签 (默认/选中状态)
5. 头像 (4 个尺寸)

【页面列表】
1. 登录页
2. 首页 (Tab + 内容列表)
3. 详情页
4. 发布页
5. 分类页
6. 我的页面

【设计原则】
- 少即是多，避免过度设计
- 保持视觉一致性
- 温暖友好的配色和圆角
- 清晰的层级关系

请使用妙多的样式系统和 AI 功能，高效完成这套设计系统。
```

---

**版本**: 1.0.0  
**工具**: 妙多 (Miaoduo AI)  
**更新日期**: 2024-11-17
