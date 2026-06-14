# Svton CDP Relay — Chrome Extension

通过 Chrome 扩展连接 Svton Agent 和 Chrome，无需 `--remote-debugging-port` 启动参数。

## 工作原理

```
Svton Desktop (WS :9223) ←→ Chrome Extension (background.js) ←→ Chrome Debugger API
```

1. Svton Desktop 运行 WebSocket 服务端在 `ws://localhost:9223`
2. 扩展自动连接 Svton
3. Svton 通过 WebSocket 发送 CDP 命令
4. 扩展通过 `chrome.debugger.sendCommand` 执行命令
5. 结果和事件通过 WebSocket 返回 Svton

## 安装

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extensions/chrome-cdp-relay/` 目录

## 使用

- 安装扩展后，它会自动连接 Svton Desktop
- 弹出窗口显示连接状态和已附加的标签页
- Svton 中的 Chrome CDP 工具会自动使用扩展连接

## 优势

- ✅ 无需特殊启动参数
- ✅ 不影响日常 Chrome 使用
- ✅ 自动重连
- ✅ 支持多个标签页
- ✅ 用户可见连接状态
