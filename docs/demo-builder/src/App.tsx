import React from 'react';

// Block components
import {
  PlanBlockView,
  FileChangeView,
  SubagentBlockView,
  WarningBlockView,
  ReferenceBlockView,
  WebSearchBlockView,
  ProgressBlockView,
  TurnDiffView,
  CommandBlockView,
  FileTreeBlockView,
  RedactedThinkingView,
  DiffView,
  ToolCallCard,
  CodeBlock,
  TurnSeparator,
} from '@svton/agent-ui';

// Types
import type { ToolCallInfo } from '@svton/agent-ui';

// ─── Demo registry ─────────────────────────────────────────

const demos: Record<string, React.FC> = {
  // Block demos
  'plan-block': PlanBlockDemo,
  'file-change': FileChangeDemo,
  'subagent': SubagentDemo,
  'warning': WarningDemo,
  'reference': ReferenceDemo,
  'web-search': WebSearchDemo,
  'progress': ProgressDemo,
  'turn-diff': TurnDiffDemo,
  'command': CommandDemo,
  'file-tree': FileTreeDemo,
  'redacted-thinking': RedactedThinkingDemo,
  'diff-view': DiffViewDemo,
  'tool-call': ToolCallDemo,
  'tool-call-shell': ToolCallShellDemo,
  'tool-call-error': ToolCallErrorDemo,
  'code-block': CodeBlockDemo,
  'turn-separator': TurnSeparatorDemo,
};

export function App() {
  const params = new URLSearchParams(window.location.search);
  const demoName = params.get('demo') || 'plan-block';
  const Demo = demos[demoName] || NotFound;

  return (
    <div className="demo-wrapper">
      <Demo />
    </div>
  );
}

function NotFound() {
  return <div className="demo-header">Demo not found. Use ?demo=xxx</div>;
}

// ─── Plan Block Demo ──────────────────────────────────────

function PlanBlockDemo() {
  return (
    <div>
      <div className="demo-header">PlanBlockView — 计划进度块</div>
      <div className="demo-content">
        <PlanBlockView plan={{
          planId: 'plan_demo',
          title: '实现用户认证功能',
          steps: [
            { id: 's1', title: '分析现有认证代码', status: 'completed' },
            { id: 's2', title: '设计 JWT token 结构', status: 'completed' },
            { id: 's3', title: '实现登录接口', status: 'in_progress' },
            { id: 's4', title: '编写单元测试', status: 'pending' },
            { id: 's5', title: '集成测试', status: 'pending' },
          ],
        }} />
      </div>
    </div>
  );
}

// ─── File Change Demo ─────────────────────────────────────

function FileChangeDemo() {
  return (
    <div>
      <div className="demo-header">FileChangeView — 文件变更块</div>
      <div className="demo-content">
        <FileChangeView changes={[
          { path: 'src/auth/login.ts', changeType: 'create', diff: '--- /dev/null\n+++ src/auth/login.ts\n@@ -0,0 +1,5 @@\n+export async function login(user: string, pass: string) {\n+  const token = await authenticate(user, pass);\n+  return token;\n+}' },
          { path: 'src/config.ts', changeType: 'modify', diff: '--- src/config.ts\n+++ src/config.ts\n@@ -3,3 +3,4 @@\n export const API_URL = "https://api.example.com";\n-export const TIMEOUT = 5000;\n+export const TIMEOUT = 10000;\n+export const RETRY = 3;' },
        ]} />
      </div>
    </div>
  );
}

// ─── Subagent Demo ────────────────────────────────────────

function SubagentDemo() {
  return (
    <div>
      <div className="demo-header">SubagentBlockView — 子代理块</div>
      <div className="demo-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SubagentBlockView
          agentId="sub_1"
          task="搜索所有使用 deprecated API 的文件"
          status="completed"
          summary="找到 3 个文件使用了 deprecated API：src/old-api.ts, src/legacy.ts, src/utils.ts。建议迁移到新的 v2 API。"
        />
        <SubagentBlockView
          agentId="sub_2"
          task="分析数据库查询性能"
          status="running"
        />
      </div>
    </div>
  );
}

// ─── Warning Demo ─────────────────────────────────────────

function WarningDemo() {
  return (
    <div>
      <div className="demo-header">WarningBlockView — 警告块</div>
      <div className="demo-content">
        <WarningBlockView text="检测到 config.toml 中的 API key 已过期，请及时更新。" source="config-check" />
      </div>
    </div>
  );
}

// ─── Reference Demo ───────────────────────────────────────

function ReferenceDemo() {
  return (
    <div>
      <div className="demo-header">ReferenceBlockView — 引用块</div>
      <div className="demo-content">
        <ReferenceBlockView refs={[
          { path: 'src/index.ts', line: 42, snippet: 'export function main()' },
          { path: 'packages/agent-ui/src/components/chat/ChatMessage.tsx' },
          { path: 'ai/agent-core/src/agent/runtime.ts', line: 201 },
        ]} />
      </div>
    </div>
  );
}

// ─── Web Search Demo ──────────────────────────────────────

function WebSearchDemo() {
  return (
    <div>
      <div className="demo-header">WebSearchBlockView — 搜索结果块</div>
      <div className="demo-content">
        <WebSearchBlockView
          query="Tauri 2 desktop app development guide"
          results={[
            { title: 'Tauri 2.0 Documentation', url: 'https://tauri.app/docs', snippet: 'Official documentation for Tauri 2.0 framework for building desktop applications.' },
            { title: 'Getting Started with Tauri 2', url: 'https://tauri.app/start', snippet: 'Learn how to create your first Tauri 2 app with this step-by-step guide.' },
            { title: 'Tauri 2 vs Electron', url: 'https://blog.example.com/tauri-vs-electron', snippet: 'Comparison of Tauri 2 and Electron for desktop app development.' },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Progress Demo ────────────────────────────────────────

function ProgressDemo() {
  return (
    <div>
      <div className="demo-header">ProgressBlockView — 进度指示块</div>
      <div className="demo-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <ProgressBlockView text="正在搜索代码库..." status="running" />
        <ProgressBlockView text="已读取 src/index.ts" status="done" />
        <ProgressBlockView text="正在执行测试..." status="running" />
        <ProgressBlockView text="测试完成 (12 通过)" status="done" />
      </div>
    </div>
  );
}

// ─── Turn Diff Demo ───────────────────────────────────────

function TurnDiffDemo() {
  return (
    <div>
      <div className="demo-header">TurnDiffView — 变更汇总块</div>
      <div className="demo-content">
        <TurnDiffView changes={[
          { path: 'src/auth/login.ts', changeType: 'create', diff: '--- /dev/null\n+++ src/auth/login.ts\n@@ -0,0 +1,3 @@\n+export function login() {\n+  return true;\n+}' },
          { path: 'src/auth/logout.ts', changeType: 'create', diff: '--- /dev/null\n+++ src/auth/logout.ts\n@@ -0,0 +1,3 @@\n+export function logout() {\n+  return true;\n+}' },
          { path: 'src/config.ts', changeType: 'modify', diff: '--- src/config.ts\n+++ src/config.ts\n@@ -1,3 +1,3 @@\n-export const DEBUG = false;\n+export const DEBUG = true;' },
        ]} />
      </div>
    </div>
  );
}

// ─── Command Demo ─────────────────────────────────────────

function CommandDemo() {
  return (
    <div>
      <div className="demo-header">CommandBlockView — 操作按钮块</div>
      <div className="demo-content" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <CommandBlockView label="运行测试" action="run_tests" icon="▶" onCommand={(a) => alert(`执行: ${a}`)} />
        <CommandBlockView label="查看结果" action="view_results" icon="📋" onCommand={(a) => alert(`执行: ${a}`)} />
        <CommandBlockView label="部署" action="deploy" icon="🚀" onCommand={(a) => alert(`执行: ${a}`)} />
      </div>
    </div>
  );
}

// ─── File Tree Demo ───────────────────────────────────────

function FileTreeDemo() {
  return (
    <div>
      <div className="demo-header">FileTreeBlockView — 目录树块</div>
      <div className="demo-content">
        <FileTreeBlockView tree={[
          { name: 'src', type: 'dir', children: [
            { name: 'index.ts', type: 'file' },
            { name: 'app.tsx', type: 'file' },
            { name: 'components', type: 'dir', children: [
              { name: 'Sidebar.tsx', type: 'file' },
              { name: 'MainLayout.tsx', type: 'file' },
              { name: 'ChatPanel.tsx', type: 'file' },
            ]},
            { name: 'hooks', type: 'dir', children: [
              { name: 'useGitBranch.ts', type: 'file' },
            ]},
          ]},
          { name: 'package.json', type: 'file' },
          { name: 'tsconfig.json', type: 'file' },
          { name: 'README.md', type: 'file' },
        ]} />
      </div>
    </div>
  );
}

// ─── Redacted Thinking Demo ───────────────────────────────

function RedactedThinkingDemo() {
  return (
    <div>
      <div className="demo-header">RedactedThinkingView — 隐藏思考块</div>
      <div className="demo-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <RedactedThinkingView reason="contains sensitive credentials" />
        <RedactedThinkingView />
        <RedactedThinkingView reason="internal reasoning redacted for compliance" />
      </div>
    </div>
  );
}

// ─── Diff View Demo ───────────────────────────────────────

function DiffViewDemo() {
  return (
    <div>
      <div className="demo-header">DiffView — Diff 渲染</div>
      <div className="demo-content">
        <DiffView diff={`--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,7 +10,12 @@
 export function formatDate(date: Date): string {
-  return date.toISOString();
+  const year = date.getFullYear();
+  const month = String(date.getMonth() + 1).padStart(2, '0');
+  const day = String(date.getDate()).padStart(2, '0');
+  return \`\${year}-\${month}-\${day}\`;
 }
+export function parseDate(str: string): Date {
+  return new Date(str);
+}`} />
      </div>
    </div>
  );
}

// ─── Tool Call Demo ───────────────────────────────────────

function ToolCallDemo() {
  const toolCall: ToolCallInfo = {
    id: 'tc1',
    name: 'file_read',
    arguments: { path: 'src/index.ts' },
    result: { output: 'export function main() {\n  console.log("Hello, World!");\n}' },
    status: 'completed',
  };
  return (
    <div>
      <div className="demo-header">ToolCallCard — 通用工具调用（已完成）</div>
      <div className="demo-content">
        <ToolCallCard toolCall={toolCall} defaultCollapsed={false} />
      </div>
    </div>
  );
}

function ToolCallShellDemo() {
  const toolCall: ToolCallInfo = {
    id: 'tc2',
    name: 'bash',
    arguments: { command: 'ls -la src/ && echo "---" && wc -l src/*.ts' },
    result: { output: 'total 24\ndrwxr-xr-x  5 user  staff  160 Jan  1 12:00 .\n-rw-r--r--  1 user  staff  200 Jan  1 12:00 index.ts\n-rw-r--r--  1 user  staff  180 Jan  1 12:00 app.tsx\n---\n     10 src/index.ts\n     15 src/app.tsx\n     25 total' },
    status: 'completed',
  };
  return (
    <div>
      <div className="demo-header">ToolCallCard — Shell 命令调用</div>
      <div className="demo-content">
        <ToolCallCard toolCall={toolCall} defaultCollapsed={false} />
      </div>
    </div>
  );
}

function ToolCallErrorDemo() {
  const toolCall: ToolCallInfo = {
    id: 'tc3',
    name: 'file_read',
    arguments: { path: '/nonexistent/file.ts' },
    result: { output: 'Error: ENOENT: no such file or directory', isError: true },
    status: 'error',
  };
  return (
    <div>
      <div className="demo-header">ToolCallCard — 失败的工具调用</div>
      <div className="demo-content">
        <ToolCallCard toolCall={toolCall} defaultCollapsed={false} />
      </div>
    </div>
  );
}

// ─── Code Block Demo ──────────────────────────────────────

function CodeBlockDemo() {
  return (
    <div>
      <div className="demo-header">CodeBlock — 代码块</div>
      <div className="demo-content">
        <CodeBlock
          code={`const agent = createAgent({\n  model: 'gpt-4o',\n  apiKey: process.env.OPENAI_API_KEY,\n  tools: [fileRead, bash],\n});\n\nconst result = await agent.run('分析项目结构');`}
          language="typescript"
          filename="example.ts"
        />
      </div>
    </div>
  );
}

// ─── Turn Separator Demo ──────────────────────────────────

function TurnSeparatorDemo() {
  return (
    <div>
      <div className="demo-header">TurnSeparator — 对话轮次分隔符</div>
      <div className="demo-content" style={{ padding: '20px' }}>
        <div style={{ padding: '12px', color: '#999', fontSize: '13px' }}>用户消息内容...</div>
        <TurnSeparator />
        <div style={{ padding: '12px', color: '#999', fontSize: '13px' }}>AI 回复内容...</div>
        <TurnSeparator duration="2.3s" />
        <div style={{ padding: '12px', color: '#999', fontSize: '13px' }}>用户再次提问...</div>
      </div>
    </div>
  );
}
