import type { ToolCall, ToolResult } from '../types';

export function mousePointResult(
  call: ToolCall,
  output: string,
  x: number,
  y: number,
  button?: string,
): ToolResult {
  return {
    callId: call.id,
    output,
    metadata: button === undefined ? { x, y } : { x, y, button },
  };
}

export function mousePointErrorResult(
  call: ToolCall,
  output: string,
  x: number,
  y: number,
  button?: string,
): ToolResult {
  return {
    ...mousePointResult(call, output, x, y, button),
    isError: true,
  };
}

export function mouseDragResult(
  call: ToolCall,
  output: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  button: string,
): ToolResult {
  return {
    callId: call.id,
    output,
    metadata: { startX, startY, endX, endY, button },
  };
}

export function mouseDragErrorResult(
  call: ToolCall,
  output: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  button: string,
): ToolResult {
  return {
    ...mouseDragResult(call, output, startX, startY, endX, endY, button),
    isError: true,
  };
}
