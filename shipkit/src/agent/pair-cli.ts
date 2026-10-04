// `node server.js --pair [--role builder|runtime] [--ttl-min N] [--list]`
// Local administrative tool: mint one-time pairing codes ON the machine (SSH/console).
// A code is printed exactly once; the store keeps only its hash. Never prints tokens.

import path from 'node:path';
import { SecurityStore, type PairRole } from './security.js';

interface PairFlags {
  role?: string;
  ttlMin: number;
  list: boolean;
}

function parseArgs(argv: string[]): PairFlags {
  const flags: PairFlags = { ttlMin: 15, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') flags.list = true;
    else if (a === '--role') flags.role = argv[++i];
    else if (a === '--ttl-min') flags.ttlMin = Number(argv[++i]);
    else if (a !== '--pair') throw new Error(`unknown --pair option: ${a}`);
  }
  return flags;
}

export async function runPairCli(argv: string[], workRoot: string, agentRole: string): Promise<number> {
  const flags = parseArgs(argv);
  const store = new SecurityStore(path.join(workRoot, 'security.json'));
  await store.load();

  if (flags.list) {
    const codes = await store.listCodes();
    if (codes.length === 0) {
      console.log('当前没有配对码记录。');
      return 0;
    }
    for (const c of codes) {
      const state = c.consumed ? '已使用' : new Date(c.expiresAt) > new Date() ? '有效' : '已过期';
      console.log(`${c.id}  role=${c.role}  ${state}  至 ${c.expiresAt}  尝试 ${c.attempts}/${c.maxAttempts}`);
    }
    return 0;
  }

  const role = (flags.role ?? (agentRole === 'both' ? '' : agentRole)) as PairRole;
  if (role !== 'builder' && role !== 'runtime') {
    console.error('用法: node server.js --pair --role builder|runtime [--ttl-min N] [--list]');
    console.error(agentRole === 'both' ? '该 agent 同时承担两种角色，必须显式指定 --role。' : '');
    return 2;
  }
  if (agentRole !== 'both' && agentRole !== role) {
    console.error(`该 agent 的角色是 ${agentRole}，不能为 ${role} 创建配对码。`);
    return 2;
  }
  const { code, id, expiresAt } = await store.createCode(role, flags.ttlMin);
  console.log(`配对码已创建（编号 ${id}，${flags.ttlMin} 分钟内有效，只显示这一次，已用/过期即作废）：`);
  console.log(`  ${code}`);
  console.log('使用者在控制器上运行：ship pair <本机 agent 入口 URL>');
  console.log('并把这枚配对码交给使用者；通过受信渠道传递，不要粘贴到公开场合。');
  return 0;
}
