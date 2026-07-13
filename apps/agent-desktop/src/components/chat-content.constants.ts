import type { PresetItem } from '@svton/agent-ui';

export const CHAT_PRESETS: PresetItem[] = [
  { label: '帮我写一个 React 组件', prompt: '帮我写一个 React 组件，要求使用 TypeScript，支持 props 类型检查' },
  { label: '解释这段代码的工作原理', prompt: '请解释这段代码的工作原理，逐行分析关键逻辑' },
  { label: '帮我修复这个 Bug', prompt: '帮我分析和修复一个 Bug，我会描述具体的错误信息和复现步骤' },
  { label: '优化代码性能', prompt: '请帮我审查并优化代码的性能，找出潜在的性能瓶颈' },
];
