import { getMcpServerName, getToolDisplayName } from './tool-names';
import type { ToolCallInfo } from './tool-call-card.types';
import type { Translator } from '@svton/ui/i18n';

const SHELL_TOOLS = new Set(['bash', 'shell', 'exec', 'run_command', 'terminal']);
const FILE_EDIT_TOOLS = new Set(['file_edit', 'edit', 'write_file', 'create_file', 'apply_diff']);
const COMPUTER_USE_TOOLS = new Set([
  'screenshot', 'mouse_click', 'mouse_double_click', 'mouse_move', 'mouse_down',
  'mouse_up', 'mouse_drag', 'scroll', 'keyboard_type', 'keyboard_press_key',
  'chrome_navigate', 'chrome_screenshot', 'chrome_click', 'chrome_type',
  'chrome_evaluate', 'chrome_get_content',
]);
const SCREENSHOT_TOOLS = new Set(['screenshot', 'chrome_screenshot']);

export const TOOL_OUTPUT_MAX_LINES = 5;

export interface ToolCallPresentation {
  displayName: string;
  mcpServer?: string;
  shellCommand: string;
  fileName: string;
  argsPreview: string;
  isShell: boolean;
  isFileEdit: boolean;
  isComputerUse: boolean;
  isScreenshotTool: boolean;
}

export function describeToolCall(toolCall: ToolCallInfo, translate: Translator): ToolCallPresentation {
  const isShell = SHELL_TOOLS.has(toolCall.name);
  const isFileEdit = FILE_EDIT_TOOLS.has(toolCall.name);
  const isComputerUse = COMPUTER_USE_TOOLS.has(toolCall.name);
  return {
    displayName: getToolDisplayName(toolCall.name, translate),
    mcpServer: getMcpServerName(toolCall.name) ?? undefined,
    shellCommand: isShell ? String(toolCall.arguments.command ?? '') : '',
    fileName: isFileEdit
      ? String(toolCall.arguments.path ?? toolCall.arguments.file_path ?? '') : '',
    argsPreview: !isShell && !isFileEdit ? previewArguments(toolCall.arguments) : '',
    isShell,
    isFileEdit,
    isComputerUse,
    isScreenshotTool: SCREENSHOT_TOOLS.has(toolCall.name),
  };
}

function previewArguments(args: Record<string, unknown>): string {
  return Object.entries(args).map(([key, value]) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return `${key}: ${text.length > 30 ? `${text.slice(0, 30)}…` : text}`;
  }).join(', ');
}

export function truncateToolOutput(output: string, maxLines: number) {
  const lines = output.split('\n');
  if (lines.length <= maxLines) return { text: output, truncated: 0 };
  const tailCount = Math.ceil(maxLines / 2);
  const headCount = Math.floor(maxLines / 2);
  const truncated = lines.length - headCount - tailCount;
  return {
    text: [...lines.slice(0, headCount), `  ... +${truncated} lines`, ...lines.slice(-tailCount)].join('\n'),
    truncated,
  };
}
