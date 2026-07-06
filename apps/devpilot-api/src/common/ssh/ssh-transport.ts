/**
 * SSH 传输抽象。
 *
 * 把 `SshLiveServerExecutorAdapter` 对"如何执行远程命令"的依赖收敛成接口，
 * 使传输实现（ssh2 vs CLI spawn vs mock）可替换。adapter 只关心：
 *  - 执行一段脚本（stdin 传入）并收集 stdout/stderr/exitCode + 超时/取消
 *  - 执行一条远程命令（用于进程树 kill）
 *
 * 取消语义：`execScript` 的 `signal` 触发后应尽快结束远端进程并 resolve（非 reject），
 * 由调用方根据 `cancelled`/`timedOut` 字段决定结果语义。
 */
export interface SshTransportExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  cancelled: boolean;
}

export interface SshTransportExecOptions {
  /** 超时毫秒；到点后 transport 应终止远端执行并置 timedOut=true。 */
  timeoutMs: number;
  /** 取消信号；触发后 transport 应终止远端执行并置 cancelled=true。 */
  signal?: SshCancellationSignal;
  /** stdout/stderr 累积回调（用于流式解析 PID marker）。 */
  onData?: (chunk: { stdout?: string; stderr?: string }) => void;
}

/** 取消信号：`aborted` 为真时表示已取消；`onAbort` 注册回调。 */
export interface SshCancellationSignal {
  readonly aborted: boolean;
  onAbort(callback: () => void): () => void;
}

export interface SshTransport {
  /**
   * 执行一段脚本：通过 stdin 写入 `script`，远端用 `bash -se` 执行，
   * 收集 stdout/stderr，支持超时与取消。
   */
  execScript(script: string, options: SshTransportExecOptions): Promise<SshTransportExecResult>;

  /**
   * 执行一条远程命令（非交互），用于进程树 kill 等清理操作。
   * 返回 exitCode（0/null 视为成功），失败 reject。
   */
  execCommand(command: string, options: { timeoutMs: number }): Promise<{ exitCode: number | null; stderr: string }>;

  /** 释放传输底层连接（如有）。 */
  dispose?(): void | Promise<void>;
}

export interface SshTransportCredentials {
  host: string;
  port: number;
  username: string;
  /** 私钥内容（PEM）。 */
  privateKey?: string;
  /** 密码（password auth）。 */
  password?: string;
}
