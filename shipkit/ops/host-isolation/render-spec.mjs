#!/usr/bin/env node
// Derive a temporary-host spec from the single maintained platform spec.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '../../package.json'));
const yaml = require('js-yaml');
const args = process.argv.slice(2);
if (args.length !== 1) throw new Error('Usage: render-spec.mjs OUTPUT (host config supplied via environment)');
const network = process.env.SHIPKIT_CONTROL_NETWORK ?? 'shipkit-control';
if (!/^[a-z][a-z0-9-]{0,62}$/.test(network)) throw new Error('Invalid control network name');
const base = yaml.load(fs.readFileSync(path.join(here, '../container/ship.yaml'), 'utf8'));
const server = base?.services?.server;
if (!server || base.schemaVersion !== 2) throw new Error('Maintained platform spec is missing');
server.networks = [network];
server.runtime = { ...server.runtime, restartPolicy: 'on-failure:3' };
const output = path.resolve(args[0]);
if (fs.existsSync(output)) throw new Error('Refuses to overwrite an existing spec');
fs.writeFileSync(output, yaml.dump(base, { lineWidth: 100 }), { flag: 'wx', mode: 0o600 });
console.log(`Derived temporary-host spec: ${output}`);
