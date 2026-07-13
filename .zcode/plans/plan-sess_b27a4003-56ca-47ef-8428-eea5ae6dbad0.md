## Codex/ZCode 布局对齐 + 双击标题栏放大缩小

### 问题分析

当前布局有两个问题：
1. **标题栏不统一**：Sidebar header（`pt-9` ≈68px）和 MainLayout title bar（`h-10` =40px）高度不一致，顶部视觉割裂。Codex/ZCode 风格是一个统一、连续的顶部拖拽区域。
2. **双击不能放大缩小**：没有 `onDoubleClick` + `toggleMaximize` 逻辑，也没有 Tauri 权限。

### 方案

#### 1. 统一顶部拖拽区域（Codex 风格）

把 Sidebar header 和 MainLayout title bar 统一为同一高度的连续顶部条：

- **Sidebar header**：保持 `pt-9`（为 macOS traffic lights 留空），但与右侧 title bar 对齐——两者底部齐平
- **MainLayout title bar**：高度改为与 sidebar header 底部对齐（`h-[68px]` 或用 padding 对齐），保持一致的 `bg-[#111]` + `border-b`
- 两个区域都是拖拽区，视觉上是一条连贯的顶部条

简化方案：**不改高度结构**（sidebar 的 `pt-9` 已经为 traffic lights 预留），只在 MainLayout title bar 加对齐 padding，让两者顶部视觉统一。

#### 2. 双击标题栏放大缩小

**A. Tauri 权限**
`capabilities/default.json` 加 `core:window:allow-toggle-maximize`

**B. 共享窗口控制 helper**
新建 `apps/agent-desktop/src/lib/window-controls.ts`：
```ts
import type { Window } from '@tauri-apps/api/window';

let _win: Window | null = null;
async function getWin(): Promise<Window | null> {
  if (_win) return _win;
  try {
    const mod = await import('@tauri-apps/api/window' as string);
    _win = mod.getCurrentWindow();
    return _win;
  } catch { return null; }
}

export async function startDragging() { (await getWin())?.startDragging(); }
export async function toggleMaximize() { (await getWin())?.toggleMaximize(); }
```

**C. 双击 handler**
在 Sidebar header 和 MainLayout title bar 的 drag region 上加 `onDoubleClick`：
```tsx
onDoubleClick={() => toggleMaximize()}
```

替换两处重复的 `startDraggingFn` / `handleDragStart` 为共享的 `startDragging`。

#### 3. 涉及文件

| 文件 | 改动 |
|---|---|
| `apps/agent-desktop/src-tauri/capabilities/default.json` | 加 `core:window:allow-toggle-maximize` 权限 |
| `apps/agent-desktop/src/lib/window-controls.ts`（新增） | 共享 `startDragging` + `toggleMaximize` |
| `apps/agent-desktop/src/components/MainLayout.tsx` | title bar 加 `onDoubleClick={toggleMaximize}`；用共享 helper 替换重复的 drag 代码 |
| `apps/agent-desktop/src/components/Sidebar.tsx` | header 加 `onDoubleClick={toggleMaximize}`；用共享 helper 替换重复的 drag 代码 |

#### 4. 验证
- 双击 sidebar header → 窗口放大/还原
- 双击 main title bar → 窗口放大/还原
- 拖拽仍然正常
- Tauri 构建无权限错误