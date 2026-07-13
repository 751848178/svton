import { describe, expect, it } from 'vitest';

import {
  buildOpenReferenceCommand,
  resolveReferencePath,
  shellQuote,
} from '../src/lib/reference-open.utils';

describe('reference-open utils', () => {
  it('resolves relative paths against the working directory', () => {
    expect(resolveReferencePath('src/App.tsx', '/Users/me/project')).toBe('/Users/me/project/src/App.tsx');
    expect(resolveReferencePath('src/App.tsx', '/Users/me/project/')).toBe('/Users/me/project/src/App.tsx');
  });

  it('leaves absolute and home paths unchanged', () => {
    expect(resolveReferencePath('/tmp/output file.txt', '/Users/me/project')).toBe('/tmp/output file.txt');
    expect(resolveReferencePath('~/notes/todo.md', '/Users/me/project')).toBe('~/notes/todo.md');
  });

  it('shell-quotes paths for macOS open command', () => {
    expect(shellQuote('/Users/me/My Project/file.txt')).toBe("'/Users/me/My Project/file.txt'");
    expect(shellQuote("/Users/me/it's here/file.txt")).toBe("'/Users/me/it'\\''s here/file.txt'");
    expect(shellQuote('~/My Project/file.txt')).toBe("~/'My Project/file.txt'");
  });

  it('builds a string command for Tauri process_exec', () => {
    expect(buildOpenReferenceCommand('src/My File.tsx', '/Users/me/project')).toBe(
      "open '/Users/me/project/src/My File.tsx'",
    );
    expect(buildOpenReferenceCommand('~/My File.tsx', '/Users/me/project')).toBe("open ~/'My File.tsx'");
  });
});
