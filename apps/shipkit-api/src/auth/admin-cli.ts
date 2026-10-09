import 'reflect-metadata';
import { DatabaseService } from '../database/database.service.js';
import { AccountAdmin } from './accounts.js';
import { hiddenInput } from './hidden-input.js';

export async function adminCli(args: string[]): Promise<void> {
  const values = new Map<string, string>(); let disable = false;
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (option === '--disable') { disable = true; continue; }
    if (!['--username', '--display-name'].includes(option!) || !args[index + 1] || args[index + 1]!.startsWith('--')) throw new Error('用法: auth:admin --username <name> [--display-name <name>] [--disable]');
    values.set(option!, args[++index]!);
  }
  const name = values.get('--username'); if (!name) throw new Error('需要 --username；密码仅通过终端隐藏输入');
  let password = '';
  if (!disable) {
    password = await hiddenInput('密码（至少12字符，输入不显示）: ');
    if (password !== await hiddenInput('再次输入密码: ')) throw new Error('两次密码不一致');
  }
  const db = new DatabaseService();
  try {
    await db.onModuleInit(); const accounts = new AccountAdmin(db);
    if (disable) await accounts.disable(name); else await accounts.upsert(name, password, values.get('--display-name') ?? name);
    console.log(disable ? '账号已停用，既有会话已撤销' : '账号已初始化，既有会话已撤销');
  } finally { password = ''; await db.onModuleDestroy(); }
}
if (require.main === module) {
  void adminCli(process.argv.slice(2)).catch(() => { console.error('账号初始化未完成，请检查交互输入、数据库迁移及账号参数'); process.exitCode = 1; });
}
