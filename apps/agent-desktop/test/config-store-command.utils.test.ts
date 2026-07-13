import { describe, expect, it } from 'vitest';
import { buildEnsureDirCommand, buildOpenPathCommand } from '../src/lib/config-store-command.utils';

describe('config-store command utils', () => {
  it('escapes POSIX apostrophes before building shell commands', () => {
    const path = "/tmp/bad' ; touch /tmp/pwn #";

    expect(buildEnsureDirCommand(path, 'MacIntel')).toBe("mkdir -p '/tmp/bad'\\'' ; touch /tmp/pwn #'");
    expect(buildOpenPathCommand(path, 'MacIntel')).toBe("open '/tmp/bad'\\'' ; touch /tmp/pwn #'");
  });

  it('escapes Windows cmd metacharacters before building shell commands', () => {
    const path = String.raw`C:\Users\bad"& calc %TEMP%`;

    expect(buildEnsureDirCommand(path, 'Win32')).toBe(String.raw`mkdir "C:\Users\bad^"^& calc ^%TEMP^%"`);
    expect(buildOpenPathCommand(path, 'Win32')).toBe(String.raw`start "" "C:\Users\bad^"^& calc ^%TEMP^%"`);
  });
});
