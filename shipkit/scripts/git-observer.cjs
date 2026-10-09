const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const token = process.env.SHIPKIT_FIXTURE_TOKEN;
const fingerprints = token ? [token, encodeURIComponent(token), Buffer.from('x-access-token:' + token).toString('base64')] : [];
const leaked = (text) => fingerprints.some(value => String(text).includes(value));
const run = spawnSync(process.env.SHIPKIT_FIXTURE_REAL_GIT, args, { encoding: 'buffer', env: process.env, maxBuffer: 16 * 1024 * 1024 });
const directories = [process.cwd()];
for (let i = 0; i < args.length; i++) if (args[i] === '-C' || args[i] === '--git-dir') directories.push(args[i + 1]);
for (const arg of args) if (arg.startsWith('--git-dir=')) directories.push(arg.slice(10));
let configLeaked = false;
for (const directory of directories) for (const file of [path.join(directory, 'config'), path.join(directory, '.git/config')]) {
  if (fs.existsSync(file)) configLeaked ||= leaked(fs.readFileSync(file, 'utf8'));
}
fs.appendFileSync(process.env.SHIPKIT_FIXTURE_OBSERVATIONS, JSON.stringify({
  argvLeaked: leaked(args.join('\0')), configLeaked, outputLeaked: leaked(Buffer.concat([run.stdout || Buffer.alloc(0), run.stderr || Buffer.alloc(0)]).toString()),
  askpass: process.env.GIT_ASKPASS || null, credentialFile: process.env.SHIPKIT_GIT_CREDENTIAL_FILE || null,
  tracingDisabled: process.env.GIT_CURL_VERBOSE === undefined && ['GIT_TRACE','GIT_TRACE_PACKET','GIT_TRACE_CURL','GIT_TRACE2'].every(key => process.env[key] === '0'),
  status: run.status,
}) + '\n', { mode: 0o600 });
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
process.exit(run.status ?? 1);
