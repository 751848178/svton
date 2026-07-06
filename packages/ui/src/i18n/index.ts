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
  'chat.usingSkill': '正在使用',
  'chat.expandProcess': '点击展开过程详情',
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

  // Computer Use Tools
  'tool.screenshot': '截图',
  'tool.mouse_click': '鼠标点击',
  'tool.mouse_double_click': '双击',
  'tool.mouse_move': '鼠标移动',
  'tool.mouse_down': '按下鼠标',
  'tool.mouse_up': '松开鼠标',
  'tool.mouse_drag': '鼠标拖拽',
  'tool.scroll': '滚动',
  'tool.keyboard_type': '键盘输入',
  'tool.keyboard_press_key': '按键',

  // Chrome CDP Tools
  'tool.chrome_navigate': 'Chrome 导航',
  'tool.chrome_screenshot': 'Chrome 截图',
  'tool.chrome_click': 'Chrome 点击',
  'tool.chrome_type': 'Chrome 输入',
  'tool.chrome_evaluate': 'Chrome 执行JS',
  'tool.chrome_get_content': 'Chrome 获取内容',

  // PlanPanel
  'plan.completed': '完成',

  // Block types
  'block.plan.title': '执行计划',
  'block.file_change.summary': '{count} 个文件变更',
  'block.file_change.create': '新建',
  'block.file_change.modify': '修改',
  'block.file_change.delete': '删除',
  'block.subagent.running': '子代理执行中',
  'block.subagent.completed': '子代理已完成',
  'block.warning': '警告',
  'block.reference.title': '引用',
  'block.web_search.title': '搜索',
  'block.progress.running': '执行中',
  'block.progress.done': '完成',
  'block.turn_diff.title': '变更汇总',
  'block.command.run': '执行',
  'block.file_tree.title': '目录结构',
  'block.redacted_thinking': '思考内容已隐藏',

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
  'chat.usingSkill': 'Using',
  'chat.expandProcess': 'Click to expand process details',
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

  // Computer Use Tools
  'tool.screenshot': 'Screenshot',
  'tool.mouse_click': 'Mouse Click',
  'tool.mouse_double_click': 'Double Click',
  'tool.mouse_move': 'Mouse Move',
  'tool.mouse_down': 'Mouse Down',
  'tool.mouse_up': 'Mouse Up',
  'tool.mouse_drag': 'Mouse Drag',
  'tool.scroll': 'Scroll',
  'tool.keyboard_type': 'Keyboard Type',
  'tool.keyboard_press_key': 'Key Press',

  // Chrome CDP Tools
  'tool.chrome_navigate': 'Chrome Navigate',
  'tool.chrome_screenshot': 'Chrome Screenshot',
  'tool.chrome_click': 'Chrome Click',
  'tool.chrome_type': 'Chrome Type',
  'tool.chrome_evaluate': 'Chrome Evaluate',
  'tool.chrome_get_content': 'Chrome Get Content',

  // PlanPanel
  'plan.completed': 'done',

  // Block types
  'block.plan.title': 'Execution Plan',
  'block.file_change.summary': '{count} files changed',
  'block.file_change.create': 'Create',
  'block.file_change.modify': 'Modify',
  'block.file_change.delete': 'Delete',
  'block.subagent.running': 'Subagent running',
  'block.subagent.completed': 'Subagent completed',
  'block.warning': 'Warning',
  'block.reference.title': 'References',
  'block.web_search.title': 'Search',
  'block.progress.running': 'Running',
  'block.progress.done': 'Done',
  'block.turn_diff.title': 'Changes Summary',
  'block.command.run': 'Run',
  'block.file_tree.title': 'File Tree',
  'block.redacted_thinking': 'Thinking content redacted',

  // Modal / Drawer
  'modal.close': 'Close',

  // Export
  'export.markdown': 'Markdown',
  'export.text': 'Plain Text',
  'export.html': 'HTML',
};

const dictionaries: Record<Locale, Record<string, string>> = { zh, en };
