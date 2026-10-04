// R4 verified on a REAL pty (expect-allocated): modify ports → Ctrl+C at the
// machines step → rerun and check the resumed default on the actual terminal;
// plus a full clear-to-save run ending in `ports: []`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CLI_MAIN, freshProject, startStubAgent, type StubAgent } from './wizard-fixtures.js';
import { ptyAvailable, runExpectScript } from './pty-driver.js';

function projectConfig(stub: StubAgent): string {
  return [
    'builder:', '  mode: static', '  static:', `    url: ${stub.url}`, '    token: TA',
    `registry:`, `  url: ${stub.host}`, '  namespace: audit',
    'runtime:', '  targets:', '    staging:', `      url: ${stub.url}`, '      token: TR',
  ].join('\n') + '\n';
}

test('R4-pty: modify ports → Ctrl+C → resume shows the draft default on a real terminal', { skip: !ptyAvailable() }, async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': projectConfig(stub),
    });

    const first = await runExpectScript(`
set timeout 40
spawn node ${JSON.stringify(CLI_MAIN)} init
expect -re {应用名称}
send "\\r"
expect -re {Dockerfile \\[}
send "\\r"
expect -re {应用端口映射}
send "9090:3000\\r"
expect -re {健康检查路径}
send "\\r"
expect -re {环境变量文件}
send "\\r"
expect -re {机器接入方式}
send "1\\r"
expect -re {构建机 agent 入口 URL}
send "\\x03"
expect -re {已取消}
puts "CAPTURED:CANCELLED"
`, { cwd: dir, timeoutMs: 50_000 });

    assert.ok(first.includes('CAPTURED:CANCELLED'), first.slice(-500));
    const state = JSON.parse(await readFile(path.join(dir, '.ship', 'init-state.json'), 'utf8')) as { app?: { ports?: string[] } };
    assert.deepEqual(state.app?.ports, ['9090:3000'], 'draft saved the user\'s new mapping');

    const second = await runExpectScript(`
set timeout 40
spawn node ${JSON.stringify(CLI_MAIN)} init
expect -re {应用名称}
send "\\r"
expect -re {Dockerfile \\[}
send "\\r"
expect -re {应用端口映射.*}
puts "PORTSLINE:$expect_out(0,string)"
send "\\x03"
expect -re {已取消}
puts "CAPTURED:RESUMED"
`, { cwd: dir, timeoutMs: 50_000 });

    assert.ok(second.includes('CAPTURED:RESUMED'), second.slice(-500));
    // expect's puts interleaves with the pty echo — PORTSLINE is not necessarily at line start
    const idx = second.indexOf('PORTSLINE:');
    const line = idx >= 0 ? second.slice(idx, second.indexOf('\n', idx) === -1 ? undefined : second.indexOf('\n', idx)).replace(/\r/g, '') : '';
    assert.ok(line.includes('9090:3000'), `the terminal default must be the draft value: ${line || second.slice(-300)}`);
    assert.ok(!line.includes('8080:3000'), `not the stale file value: ${line}`);
  } finally {
    await stub.close();
  }
});

test('R4-pty-clear: clearing ports with - persists through a full real-terminal run', { skip: !ptyAvailable() }, async () => {
  const stub = await startStubAgent();
  try {
    const dir = await freshProject({
      'ship.yaml': 'name: audit-app\nports:\n  - 8080:3000\n',
      'ship.config.yaml': projectConfig(stub),
    });
    await runExpectScript(`
set timeout 40
spawn node ${JSON.stringify(CLI_MAIN)} init
expect -re {应用名称}
send "\\r"
expect -re {Dockerfile \\[}
send "\\r"
expect -re {应用端口映射}
send -- "-\\r"
expect -re {健康检查路径}
send "\\r"
expect -re {环境变量文件}
send "\\r"
expect -re {机器接入方式}
send "1\\r"
expect -re {构建机 agent 入口 URL}
send "\\r"
expect -re {构建机 agent token}
send "\\r"
expect -re {运行目标名称}
send "\\r"
expect -re {运行机 agent 入口 URL}
send "\\r"
expect -re {运行机 agent token}
send "\\r"
expect -re {镜像仓库地址}
send "\\r"
expect -re {镜像命名空间}
send "\\r"
expect -re {写入以上变更}
send "y\\r"
expect -re {初始化完成|配置已保存}
puts "CAPTURED:SAVED"
`, { cwd: dir, timeoutMs: 60_000 });

    const spec = await readFile(path.join(dir, 'ship.yaml'), 'utf8');
    assert.match(spec, /ports: \[\]/, `clearing persists as an explicit empty list: ${spec}`);
  } finally {
    await stub.close();
  }
});
