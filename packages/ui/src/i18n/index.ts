export type Locale = 'zh' | 'en';

let currentLocale: Locale = getDefaultLocale();

function getDefaultLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh';
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Look up a key in the locale dictionaries.
 * Falls back to the key itself if not found.
 */
export function t(key: string): string {
  const dict = dictionaries[currentLocale];
  return (dict as Record<string, string>)[key] ?? key;
}

const zh: Record<string, string> = {
  // ChatPanel
  'chat.emptyMessage': '开始对话...',
  'chat.thinking': '思考中...',
  'chat.scrollToBottom': '回到底部',
  'chat.matchedSkills': '已匹配技能',
  'chat.contextCompacted': '上下文已压缩',

  // ChatInput
  'chat.inputPlaceholder': '输入消息...',
  'chat.commands': '命令',

  // ChatMessage
  'chat.send': '发送',
  'chat.cancel': '取消',
  'chat.editHint': 'Enter 发送 · Esc 取消 · Shift+Enter 换行',
  'chat.editMessage': '编辑消息',

  // Actions
  'action.copy': '复制',
  'action.copied': '已复制',
  'action.edit': '编辑',
  'action.export': '导出',
  'action.retry': '重新生成',

  // ToolApproval
  'tool.title': '工具授权请求',
  'tool.needsPermission': '需要你的许可才能执行',
  'tool.parameters': '参数',
  'tool.output': '输出',
  'tool.error': '错误',
  'tool.pending': '等待授权…',
  'tool.deny': '拒绝',
  'tool.allow': '允许执行',

  // PlanPanel
  'plan.completed': '完成',

  // Modal / Drawer
  'modal.close': '关闭',

  // Export
  'export.markdown': 'Markdown',
  'export.text': '纯文本',
  'export.html': 'HTML',
};

const en: Record<string, string> = {
  // ChatPanel
  'chat.emptyMessage': 'Start a conversation...',
  'chat.thinking': 'Thinking...',
  'chat.scrollToBottom': 'Scroll to bottom',
  'chat.matchedSkills': 'Matched skills',
  'chat.contextCompacted': 'Context compacted',

  // ChatInput
  'chat.inputPlaceholder': 'Type a message...',
  'chat.commands': 'Commands',

  // ChatMessage
  'chat.send': 'Send',
  'chat.cancel': 'Cancel',
  'chat.editHint': 'Enter to send · Esc to cancel · Shift+Enter for newline',
  'chat.editMessage': 'Edit message',

  // Actions
  'action.copy': 'Copy',
  'action.copied': 'Copied',
  'action.edit': 'Edit',
  'action.export': 'Export',
  'action.retry': 'Retry',

  // ToolApproval
  'tool.title': 'Tool Authorization Request',
  'tool.needsPermission': 'requires your permission to execute',
  'tool.parameters': 'Parameters',
  'tool.output': 'Output',
  'tool.error': 'Error',
  'tool.pending': 'Pending approval...',
  'tool.deny': 'Deny',
  'tool.allow': 'Allow',

  // PlanPanel
  'plan.completed': 'done',

  // Modal / Drawer
  'modal.close': 'Close',

  // Export
  'export.markdown': 'Markdown',
  'export.text': 'Plain Text',
  'export.html': 'HTML',
};

const dictionaries: Record<Locale, Record<string, string>> = { zh, en };
