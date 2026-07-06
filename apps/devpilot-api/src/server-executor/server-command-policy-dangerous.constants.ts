import { DangerousCommandPattern } from "./server-command-policy.types";

export const DANGEROUS_COMMAND_PATTERNS: DangerousCommandPattern[] = [
  {
    key: "rm-root",
    pattern: /\brm\s+-rf\s+\/(?:\s|$)/,
    reason: "禁止递归删除根目录",
  },
  {
    key: "mkfs",
    pattern: /\bmkfs(?:\.[a-z0-9]+)?\b/i,
    reason: "禁止格式化文件系统",
  },
  {
    key: "dd-raw-disk",
    pattern: /\bdd\s+.*\bof=\/dev\//i,
    reason: "禁止直接写块设备",
  },
  {
    key: "fork-bomb",
    pattern: /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/,
    reason: "禁止 fork bomb",
  },
  {
    key: "shutdown",
    pattern: /\b(shutdown|poweroff|halt|reboot)\b/i,
    reason: "禁止关机或重启服务器",
  },
  {
    key: "pipe-to-shell",
    pattern: /\b(curl|wget)\b.*\|\s*(sh|bash)\b/i,
    reason: "禁止远程脚本直接管道到 shell",
  },
  {
    key: "passwd-shadow",
    pattern: />\s*\/etc\/(passwd|shadow)\b/i,
    reason: "禁止覆盖系统账号文件",
  },
  {
    key: "chmod-root",
    pattern: /\bchmod\s+777\s+\/(?:\s|$)/i,
    reason: "禁止修改根目录为 777",
  },
];
