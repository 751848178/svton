# SettingsView 设置面板组件

`SettingsView` 是 `@svton/agent-ui` 的全功能设置面板，通过平台适配器（`ISettingsAdapter`）抽象层实现跨平台配置管理。面板分为"个人"、"集成"、"编码"三大分组，共 15 个设置区域，涵盖 Provider 管理、个性化、工具/技能配置、MCP 服务器、权限、沙箱、自动审核等全部配置项。


---

## 概述

SettingsView 的架构特点：

1. **平台抽象**：所有数据读写通过 `ISettingsAdapter` 接口完成，每个平台（Tauri、Browser、VS Code）提供各自的实现。
2. **响应式刷新**：通过 `refreshKey` prop 触发完整状态重读；适配器内部变更也可通过 `reloadAgent()` 驱动局部刷新。
3. **分组导航**：左侧侧栏按"个人 / 集成 / 编码"三组展示所有区域，支持搜索过滤。
4. **条件区域**：某些区域（如"网页搜索"）仅在适配器实现对应方法时才显示。
5. **CRUD 操作**：技能和 MCP 服务器支持完整的增删改查操作。

---

## 全部 15 个设置区域

SettingsView 的 `DEFAULT_SECTIONS` 定义了以下区域，按分组排列：

### 个人分组

| ID | 标签 | 说明 |
|----|------|------|
| `general` | 常规 | 工作目录、存储信息、平台描述 |
| `providers` | 配置 | API Provider 管理（添加/编辑/删除）、默认模型选择 |
| `personalization` | 个性化 | 自定义系统指令（Custom Instructions） |

### 集成分组

| ID | 标签 | 说明 |
|----|------|------|
| `tools` | 工具 | Agent 可用工具列表、启用/禁用切换 |
| `skills` | 技能 | 技能列表、CRUD 操作、启用/禁用 |
| `marketplace` | 技能市场 | skills.sh 市场浏览、搜索、安装 |
| `mcp` | MCP 服务器 | MCP 服务器配置（stdio/http）、Smithery 市场安装 |
| `integrations` | 第三方集成 | 第三方服务集成卡片（GitHub、Slack 等） |

### 编码分组

| ID | 标签 | 说明 |
|----|------|------|
| `permissions` | 权限 | 权限模式选择（自动/询问/拒绝） |
| `preview` | 预览模式 | 预览模式配置 |
| `memory` | 记忆 | 记忆条目管理（添加/删除/清空） |
| `search` | 网页搜索 | 搜索端点配置（条件显示） |
| `automation` | 自动化 | 钩子（Hooks）管理 |
| `sandbox` | 沙箱 | 沙箱模式配置（启用/模式选择） |
| `auto_reviewer` | 自动审核 | 审核模式、规则配置 |

---

## ISettingsAdapter 接口

`ISettingsAdapter` 是平台抽象层，定义了 SettingsView 所需的全部数据访问方法。必选方法使用普通签名，可选方法使用 `?` 标记。

### Provider 管理

```ts
// 必选
getProviders(): ProviderInfo[];
setProviders(providers: ProviderInfo[]): void;
saveProviders(providers: ProviderInfo[]): void | Promise<void>;
```

### 模型选择

```ts
// 必选
getDefaultModel(): string;
setDefaultModel(key: string): void;
```

### Agent 运行时

```ts
// 必选 — 返回 null 表示 Agent 尚未初始化（如缺少 API Key）
getAgentData(): AgentData | null;
// 配置变更后重新加载 Agent
reloadAgent(): void | Promise<void>;
```

### 个性化

```ts
// 必选
getCustomInstructions(): string;
saveCustomInstructions(text: string): void | Promise<void>;
```

### 权限模式

```ts
// 必选
getPermissionMode(): string;
savePermissionMode(mode: string): void;
```

### 工具/技能开关

```ts
// 必选
getDisabledTools(): string[];
saveDisabledTools(names: string[]): void;
getDisabledSkills(): string[];
saveDisabledSkills(names: string[]): void;
```

### 记忆

```ts
// 必选
addMemory(text: string): void | Promise<void>;
clearMemory(): void | Promise<void>;

// 可选
getMemoryEntries?(): MemoryEntry[];
deleteMemoryEntry?(key: string): void | Promise<void>;
```

### 沙箱

```ts
// 可选
getSandboxConfig?(): { enabled: boolean; mode: string };
saveSandboxConfig?(config: { enabled: boolean; mode: string }): void;
```

### 自动审核

```ts
// 可选
getAutoReviewerConfig?(): {
  mode: string;
  rules: Array<{ id: string; description: string; verdict: string }>;
};
saveAutoReviewerMode?(mode: string): void;
```

### 技能 CRUD

```ts
// 可选
addSkill?(skill: SkillFormData): void | Promise<void>;
updateSkill?(name: string, updates: SkillFormData): void | Promise<void>;
deleteSkill?(name: string): void | Promise<void>;
```

### 技能安装

```ts
// 可选
installSkillFromUrl?(url: string): Promise<{ success: boolean; error?: string }>;
installSkillFromGit?(repo: string): Promise<{ success: boolean; error?: string }>;
installSkillFromLocal?(path: string): Promise<{ success: boolean; error?: string }>;
getInstalledSkills?(): Array<{ name: string; source: string; installedAt: number }>;
supportsAdvancedInstall?(): boolean;  // 仅桌面端返回 true
```

### 技能市场（skills.sh）

```ts
// 可选
searchMarketplace?(query: string): Promise<MarketplaceSkill[]>;
browseMarketplace?(options?: { view?: string; page?: number }): Promise<{
  skills: MarketplaceSkill[];
  total: number;
}>;
installFromMarketplace?(skillId: string): Promise<{ success: boolean; error?: string }>;
```

### MCP 服务器 CRUD

```ts
// 可选
getMcpServerConfigs?(): McpServerConfig[];
addMcpServer?(config: McpServerConfig): void | Promise<void>;
removeMcpServer?(name: string): void | Promise<void>;
toggleMcpServer?(name: string, enabled: boolean): void | Promise<void>;
getMcpServerTools?(serverName: string): Promise<string[]>;
updateMcpServerToolConfig?(serverName: string, config: {
  approvalMode?: 'auto' | 'ask' | 'deny';
  enabledTools?: string[];
  disabledTools?: string[];
}): Promise<void>;
```

### MCP 市场（Smithery）

```ts
// 可选
searchMcpMarketplace?(query: string): Promise<{
  servers: Array<{
    id: string;
    qualifiedName: string;
    displayName: string;
    description: string;
    useCount: number;
    verified: boolean;
  }>;
  pagination: { totalCount: number };
}>;
installFromMcpMarketplace?(qualifiedName: string): Promise<{ success: boolean; error?: string }>;
```

### 平台信息

```ts
// 必选
getStorageDescription(): string;

// 可选
getWorkingDir?(): string;
setWorkingDir?(dir: string): void | Promise<void>;
openInEditor?(): void | Promise<void>;
```

### 网页搜索

```ts
// 可选
getSearchEndpoint?(): string;
saveSearchEndpoint?(url: string): void;
```

### 第三方集成

```ts
// 可选
getIntegrations?(): IntegrationCardData[];
toggleIntegration?(id: string, enabled: boolean): void | Promise<void>;
setIntegrationCredential?(id: string, key: string, value: string): void | Promise<void>;
```

### 钩子（Hooks）

```ts
// 可选
getHooks?(): Array<{ event: string; id: string; priority: number }>;
unregisterHook?(event: string, id: string): void;
```

### 会话检查点

```ts
// 可选
listCheckpoints?(): Promise<Array<{
  sessionId: string;
  messageCount: number;
  model: string;
  updatedAt: number;
}>>;
deleteCheckpoint?(sessionId: string): Promise<void>;
```

---

## SettingsViewProps

```ts
export interface SettingsViewProps {
  /** 平台适配器实例 */
  adapter: ISettingsAdapter;
  /** 返回按钮回调 */
  onBack: () => void;
  /** 递增此值以强制从适配器重新读取所有状态 */
  refreshKey?: number;
}
```

---

## 代码示例：实现适配器

以下是一个完整的 Browser 平台适配器实现示例：

```tsx
import React, { useState } from 'react';
import { SettingsView } from '@svton/agent-ui';
import type {
  ISettingsAdapter, ProviderInfo, AgentData,
  SkillFormData, McpServerConfig, MemoryEntry,
} from '@svton/agent-ui';

// Browser 平台适配器：使用 localStorage 持久化
class BrowserSettingsAdapter implements ISettingsAdapter {
  private storage = window.localStorage;

  // ── Provider 管理 ──
  getProviders(): ProviderInfo[] {
    const raw = this.storage.getItem('providers');
    return raw ? JSON.parse(raw) : [];
  }

  setProviders(providers: ProviderInfo[]): void {
    this.storage.setItem('providers', JSON.stringify(providers));
  }

  async saveProviders(providers: ProviderInfo[]): Promise<void> {
    this.setProviders(providers);
  }

  // ── 模型选择 ──
  getDefaultModel(): string {
    return this.storage.getItem('defaultModel') || 'gpt-4o';
  }

  setDefaultModel(key: string): void {
    this.storage.setItem('defaultModel', key);
  }

  // ── Agent 运行时 ──
  getAgentData(): AgentData | null {
    const apiKey = this.storage.getItem('apiKey');
    if (!apiKey) return null;
    return {
      tools: [
        { name: 'bash', description: '执行 Shell 命令', parameters: {} },
        { name: 'file_edit', description: '编辑文件', parameters: {} },
      ],
      skills: [],
      permissionMode: this.getPermissionMode(),
      hasMemory: false,
      memoryText: '',
      mcpServers: [],
      hasSubagent: false,
      hasPlanning: true,
    };
  }

  async reloadAgent(): Promise<void> {
    // 重新初始化 Agent（实际应用中会重新创建 AgentClient）
    console.log('Agent 已重新加载');
  }

  // ── 个性化 ──
  getCustomInstructions(): string {
    return this.storage.getItem('customInstructions') || '';
  }

  async saveCustomInstructions(text: string): Promise<void> {
    this.storage.setItem('customInstructions', text);
  }

  // ── 权限模式 ──
  getPermissionMode(): string {
    return this.storage.getItem('permissionMode') || 'ask';
  }

  savePermissionMode(mode: string): void {
    this.storage.setItem('permissionMode', mode);
  }

  // ── 工具/技能开关 ──
  getDisabledTools(): string[] {
    const raw = this.storage.getItem('disabledTools');
    return raw ? JSON.parse(raw) : [];
  }

  saveDisabledTools(names: string[]): void {
    this.storage.setItem('disabledTools', JSON.stringify(names));
  }

  getDisabledSkills(): string[] {
    return [];
  }

  saveDisabledSkills(names: string[]): void {
    // no-op
  }

  // ── 记忆 ──
  async addMemory(text: string): Promise<void> {
    const entries = this.getMemoryEntries() ?? [];
    entries.push({
      key: `mem-${Date.now()}`,
      content: text,
      source: 'user',
      timestamp: Date.now(),
    });
    this.storage.setItem('memoryEntries', JSON.stringify(entries));
  }

  async clearMemory(): Promise<void> {
    this.storage.removeItem('memoryEntries');
  }

  getMemoryEntries(): MemoryEntry[] {
    const raw = this.storage.getItem('memoryEntries');
    return raw ? JSON.parse(raw) : [];
  }

  async deleteMemoryEntry(key: string): Promise<void> {
    const entries = this.getMemoryEntries() ?? [];
    this.storage.setItem(
      'memoryEntries',
      JSON.stringify(entries.filter(e => e.key !== key)),
    );
  }

  // ── 技能 CRUD ──
  async addSkill(skill: SkillFormData): Promise<void> {
    const skills = JSON.parse(this.storage.getItem('skills') || '[]');
    skills.push(skill);
    this.storage.setItem('skills', JSON.stringify(skills));
  }

  async deleteSkill(name: string): Promise<void> {
    const skills = JSON.parse(this.storage.getItem('skills') || '[]');
    this.storage.setItem(
      'skills',
      JSON.stringify(skills.filter((s: SkillFormData) => s.name !== name)),
    );
  }

  // ── 平台信息 ──
  getStorageDescription(): string {
    return '浏览器本地存储 (localStorage)';
  }

  // ── 平台特性：不支持高级安装 ──
  supportsAdvancedInstall(): boolean {
    return false; // Browser 平台不支持 git/local 安装
  }
}

// 使用 SettingsView
export function SettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const adapter = new BrowserSettingsAdapter();

  return (
    <SettingsView
      adapter={adapter}
      onBack={() => window.history.back()}
      refreshKey={refreshKey}
    />
  );
}
```

---

## 集成说明

### 条件区域

某些设置区域仅在适配器实现特定方法时才显示：

| 区域 | 触发条件 |
|------|----------|
| 网页搜索 | `adapter.getSearchEndpoint` 存在 |
| 第三方集成 | `adapter.getIntegrations` 存在 |
| 沙箱 | `adapter.getSandboxConfig` 存在 |
| 自动审核 | `adapter.getAutoReviewerConfig` 存在 |
| 技能市场 | `adapter.searchMarketplace` 存在 |

### 状态刷新机制

SettingsView 内部通过 `useAdapterState` Hook 管理响应式状态：

1. **初始化**：首次挂载时从适配器读取所有状态。
2. **refreshKey 变更**：当 `refreshKey` 递增时，重新读取所有状态。
3. **reloadAgent**：配置变更后调用 `adapter.reloadAgent()`，然后局部刷新 `agentData`。

```tsx
// 强制刷新示例
const [refreshKey, setRefreshKey] = useState(0);

// 当外部数据变化时（如 Agent 重新初始化后）
const handleExternalChange = () => {
  setRefreshKey(prev => prev + 1);
};

<SettingsView adapter={adapter} onBack={...} refreshKey={refreshKey} />
```

### Toast 提示

SettingsView 内置 Toast 通知机制，保存操作成功后自动显示 2 秒提示信息。

---

## 共享数据类型

```ts
interface ProviderInfo {
  id: string;
  name: string;
  type: string;        // 'openai' | 'anthropic' | ...
  baseUrl: string;
  apiKey: string;
  models: Array<{ id: string; name: string }>;
}

interface ToolInfo {
  name: string;
  description: string;
  parameters: any;
  annotations?: any;
}

interface SkillInfo {
  name: string;
  description: string;
  scope?: string;
  trigger?: { type: string };
  requiredTools?: string[];
}

interface McpServerInfo {
  name: string;
  tools?: string[];
  connected?: boolean;
}

interface SkillFormData {
  name: string;
  description: string;
  instructions: string;
  scope?: 'user' | 'repo';
}

interface McpServerConfig {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  approvalMode?: 'auto' | 'ask' | 'deny';
  enabledTools?: string[];
  disabledTools?: string[];
}

interface AgentData {
  tools: ToolInfo[];
  skills: SkillInfo[];
  permissionMode: string;
  hasMemory: boolean;
  memoryText: string;
  mcpServers: McpServerInfo[];
  hasSubagent: boolean;
  hasPlanning: boolean;
}
```

---

## 相关组件

- [ChatPanel](./chat-panel.md) — 聊天面板（与设置面板并列的主界面）
- [ChatInput](./chat-input.md) — 输入框（模型选择器通常嵌入 `leadingSlot`）
