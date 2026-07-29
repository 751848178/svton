/**
 * TCP 端口可达性检测（F383 结构约束拆分）。
 * 单一职责：纯网络探活——给 (host, port) 返回是否在 5s 内可建立 TCP 连接。
 * 不含任何凭据、SSH、业务语义，便于独立单测与复用。
 */

/** 检测目标 host:port 是否 TCP 可达（5s 超时，连接/超时/错误均归一为 boolean）。 */
export async function checkPortReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const net = require("net");
    const socket = new net.Socket();
    socket.setTimeout(5000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}
