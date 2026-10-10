// Trusted Node preload: Git passes one prompt as the Node entrypoint argument.
// NODE_OPTIONS loads this module before that entrypoint; no temporary code is executed.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const prompt = path.relative(process.cwd(), process.argv[1] ?? '');
// Stay inert for other Node children. Actual HTTPS Git prompts have this exact shape.
if (/^(Username|Password) for '.+': $/.test(prompt)) {
  try {
    const key = prompt.startsWith('Username') ? 'SHIPKIT_GIT_USERNAME_FILE' : 'SHIPKIT_GIT_CREDENTIAL_FILE';
    const file = process.env[key];
    if (!file) throw new Error('Git credential file is unavailable');
    writeFileSync(process.stdout.fd, readFileSync(file));
    process.exit(0);
  } catch {
    // Fail closed without logging credentials, file content or inherited environment.
    process.exit(1);
  }
}
