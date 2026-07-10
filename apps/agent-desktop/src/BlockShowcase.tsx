import React from 'react';
import {
  PlanBlockView, FileChangeView, SubagentBlockView, WarningBlockView,
  ReferenceBlockView, WebSearchBlockView, ProgressBlockView, TurnDiffView,
  CommandBlockView, FileTreeBlockView, RedactedThinkingView,
} from '@svton/agent-ui';

export function BlockShowcase() {
  return (
    <div className="min-h-screen bg-black text-gray-100 p-8 font-mono">
      <h1 className="text-2xl text-white font-light mb-2">ContentBlock 类型展示</h1>
      <p className="text-sm text-gray-500 mb-8">15 种消息块类型的视觉验证</p>

      <div className="max-w-2xl space-y-6">
        {/* 1. thinking */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">1. thinking (思考)</h2>
          <div className="border-l-2 border-[#333] pl-4 py-2">
            <p className="text-xs text-gray-400">用户想要了解项目的架构。我需要先查看目录结构...</p>
          </div>
        </section>

        {/* 2. tool_call */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">2. tool_call (工具调用)</h2>
          <div className="bg-[#2a2a2a] border border-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-xs">✓</span>
              <span className="text-xs text-cyan-600">bash</span>
              <span className="text-xs text-gray-400 truncate flex-1">command: ls -la src/</span>
            </div>
          </div>
        </section>

        {/* 3. text */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">3. text (结论文本)</h2>
          <div className="text-sm text-gray-100 leading-relaxed">
            根据分析，项目采用了 monorepo 架构，使用 pnpm workspace 管理依赖。
          </div>
        </section>

        {/* 4. error */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">4. error (错误)</h2>
          <div className="flex items-start gap-2">
            <span className="text-red-500 mt-px">✗</span>
            <div className="text-sm text-red-600">OpenAI API error (400): Invalid request</div>
          </div>
        </section>

        {/* 5. plan */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">5. plan (计划进度)</h2>
          <PlanBlockView plan={{
            planId: 'plan_1',
            title: '实现用户认证功能',
            steps: [
              { id: 's1', title: '分析现有认证代码', status: 'completed' },
              { id: 's2', title: '设计 JWT token 结构', status: 'completed' },
              { id: 's3', title: '实现登录接口', status: 'in_progress' },
              { id: 's4', title: '编写单元测试', status: 'pending' },
              { id: 's5', title: '集成测试', status: 'pending' },
            ],
          }} />
        </section>

        {/* 6. file_change */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">6. file_change (文件变更)</h2>
          <FileChangeView changes={[
            { path: 'src/auth/login.ts', changeType: 'create', diff: '--- /dev/null\n+++ src/auth/login.ts\n@@ -0,0 +1,5 @@\n+export async function login(user: string, pass: string) {\n+  const token = await authenticate(user, pass);\n+  return token;\n+}' },
            { path: 'src/config.ts', changeType: 'modify', diff: '--- src/config.ts\n+++ src/config.ts\n@@ -3,3 +3,4 @@\n export const API_URL = "https://api.example.com";\n-export const TIMEOUT = 5000;\n+export const TIMEOUT = 10000;\n+export const RETRY = 3;' },
          ]} />
        </section>

        {/* 7. subagent */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">7. subagent (子代理)</h2>
          <SubagentBlockView agentId="sub_1" task="搜索所有使用 deprecated API 的文件" status="completed" summary="找到 3 个文件使用了 deprecated API：src/old-api.ts, src/legacy.ts, src/utils.ts。建议迁移到新的 v2 API。" />
          <div className="mt-2" />
          <SubagentBlockView agentId="sub_2" task="分析数据库查询性能" status="running" />
        </section>

        {/* 8. warning */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">8. warning (警告)</h2>
          <WarningBlockView text="检测到 config.toml 中的 API key 已过期，请及时更新。" source="config-check" />
        </section>

        {/* 9. reference */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">9. reference (引用)</h2>
          <ReferenceBlockView refs={[
            { path: 'src/index.ts', line: 42, snippet: 'export function main()' },
            { path: 'packages/agent-ui/src/components/chat/ChatMessage.tsx' },
            { path: 'ai/agent-core/src/agent/runtime.ts', line: 201 },
          ]} />
        </section>

        {/* 10. web_search */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">10. web_search (搜索)</h2>
          <WebSearchBlockView query="Tauri 2 desktop app development guide" results={[
            { title: 'Tauri 2.0 Documentation', url: 'https://tauri.app/docs', snippet: 'Official documentation for Tauri 2.0 framework.' },
            { title: 'Getting Started with Tauri 2', url: 'https://tauri.app/start', snippet: 'Step-by-step guide for your first Tauri 2 app.' },
            { title: 'Tauri 2 vs Electron', url: 'https://blog.example.com/tauri-vs-electron', snippet: 'Comparison of Tauri 2 and Electron.' },
          ]} />
        </section>

        {/* 11. progress */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">11. progress (进度)</h2>
          <ProgressBlockView text="正在搜索代码库..." status="running" />
          <ProgressBlockView text="已读取 src/index.ts" status="done" />
        </section>

        {/* 12. turn_diff */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">12. turn_diff (变更汇总)</h2>
          <TurnDiffView changes={[
            { path: 'src/auth/login.ts', changeType: 'create', diff: '--- /dev/null\n+++ src/auth/login.ts\n@@ -0,0 +1,3 @@\n+export function login() {\n+  return true;\n+}' },
            { path: 'src/auth/logout.ts', changeType: 'create', diff: '--- /dev/null\n+++ src/auth/logout.ts\n@@ -0,0 +1,3 @@\n+export function logout() {\n+  return true;\n+}' },
            { path: 'src/config.ts', changeType: 'modify', diff: '--- src/config.ts\n+++ src/config.ts\n@@ -1,3 +1,3 @@\n-export const DEBUG = false;\n+export const DEBUG = true;' },
          ]} />
        </section>

        {/* 13. command */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">13. command (操作按钮)</h2>
          <div className="flex gap-2 flex-wrap">
            <CommandBlockView label="运行测试" action="run_tests" icon="▶" onCommand={() => {}} />
            <CommandBlockView label="查看结果" action="view_results" icon="📋" onCommand={() => {}} />
          </div>
        </section>

        {/* 14. file_tree */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">14. file_tree (目录树)</h2>
          <FileTreeBlockView tree={[
            { name: 'src', type: 'dir', children: [
              { name: 'index.ts', type: 'file' },
              { name: 'app.tsx', type: 'file' },
              { name: 'components', type: 'dir', children: [
                { name: 'Sidebar.tsx', type: 'file' },
                { name: 'MainLayout.tsx', type: 'file' },
              ]},
            ]},
            { name: 'package.json', type: 'file' },
            { name: 'tsconfig.json', type: 'file' },
          ]} />
        </section>

        {/* 15. redacted_thinking */}
        <section>
          <h2 className="text-sm text-gray-400 mb-2">15. redacted_thinking (隐藏思考)</h2>
          <RedactedThinkingView reason="contains sensitive credentials" />
        </section>
      </div>

      <div className="mt-12 text-xs text-gray-600">Svton Agent — 15 种 ContentBlock 类型验证完成</div>
    </div>
  );
}
