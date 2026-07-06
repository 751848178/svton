import type { Writable } from 'stream';

/**
 * SSE 帧（Server-Sent Events）格式化与写入工具。
 *
 * 取代 controller 内手写的 `response.write('id: ...\n')` / `event: ...\n` / `data: ...\n\n`
 * 命令式拼接。封装 SSE 协议帧格式（W3C EventSource 规范），让调用方只关心业务事件。
 *
 * 不依赖 NestJS @Sse() 装饰器——因为 log-center 的 SSE 是有状态流式查询
 *（自定义 response header / 会话治理 / cursor resume），需要直接控制 response 流。
 * 本工具把"帧格式"这一协议细节抽离，减少散布的字符串拼接。
 */
export interface SseEvent {
  /** 事件类型（event: 行）；不传则默认 message。 */
  event?: string;
  /** 事件数据（data: 行，对象会 JSON.stringify）。 */
  data: unknown;
  /** 事件 ID（id: 行，供客户端 Last-Event-ID 续接）。 */
  id?: string;
  /** 重连间隔建议毫秒（retry: 行）。 */
  retryMs?: number;
}

export class SseFrameWriter {
  constructor(private readonly writable: Writable & { writableEnded?: boolean }) {}

  /** 是否仍可写（连接未关闭）。 */
  get active(): boolean {
    return !this.writable.writableEnded;
  }

  /**
   * 写入一个 SSE 事件帧。返回是否成功写入（连接已关闭时返回 false）。
   * 按行 write（与原手写 `response.write('event: ...\n')` 行为一致，保持输出字节流不变）。
   */
  write(event: SseEvent): boolean {
    if (this.writable.writableEnded) return false;
    if (event.id !== undefined) this.writable.write(`id: ${event.id}\n`);
    if (event.retryMs !== undefined) this.writable.write(`retry: ${event.retryMs}\n`);
    if (event.event) this.writable.write(`event: ${event.event}\n`);
    const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
    // data 可多行，每行前缀 data:
    for (const line of dataStr.split('\n')) {
      this.writable.write(`data: ${line}\n`);
    }
    this.writable.write('\n');
    return true;
  }

  /** 写入注释行（: 开头，SSE 心跳保活用）。 */
  writeComment(text: string): boolean {
    if (this.writable.writableEnded) return false;
    this.writable.write(`: ${text}\n\n`);
    return true;
  }
}

/**
 * 构造 SSE 响应头（Content-Type / Cache-Control / Connection 等）。
 * 集中管理 header 名，避免散布的魔法字符串。
 */
export const SSE_HEADERS = {
  contentType: 'text/event-stream; charset=utf-8',
  cacheControl: 'no-cache, no-transform',
  connection: 'keep-alive',
  xAccelBuffering: 'no',
} as const;
