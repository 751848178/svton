import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [zh, en] = await Promise.all([
  readJson(join(root, 'messages/zh.json')),
  readJson(join(root, 'messages/en.json')),
]);
const zhMessages = flatten(zh);
const enMessages = flatten(en);
const onlyZh = [...zhMessages.keys()].filter((key) => !enMessages.has(key));
const onlyEn = [...enMessages.keys()].filter((key) => !zhMessages.has(key));
const placeholderDrift = [...zhMessages.keys()]
  .filter((key) => enMessages.has(key))
  .filter((key) => placeholders(zhMessages.get(key)).join(',') !== placeholders(enMessages.get(key)).join(','));

if (onlyZh.length || onlyEn.length || placeholderDrift.length) {
  process.stderr.write(`${JSON.stringify({ onlyZh, onlyEn, placeholderDrift }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`zh/en parity passed: ${zhMessages.size} leaf messages, keys and ICU placeholders match\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function flatten(value, prefix = '', result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, path, result);
    } else {
      result.set(path, String(child));
    }
  }
  return result;
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z0-9_]+)(?:,[^}]*)?\}/g)]
    .map((match) => match[1])
    .sort();
}
