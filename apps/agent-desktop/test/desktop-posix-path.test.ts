import { describe, expect, it } from 'vitest';
import {
  join,
  posix,
  resolve,
} from '@/lib/desktop-posix-path.utils';

describe('Desktop browser POSIX path shim', () => {
  it('joins paths while normalizing dot segments', () => {
    expect(join('/workspace/project', 'src', '../file.ts'))
      .toBe('/workspace/project/file.ts');
    expect(join('/workspace/', '/nested//', './file.ts'))
      .toBe('/workspace/nested/file.ts');
    expect(join('', '')).toBe('.');
  });

  it('resolves from the rightmost absolute segment', () => {
    expect(resolve('/workspace/project', '../other'))
      .toBe('/workspace/other');
    expect(resolve('/ignored', '/tmp', '../var/log'))
      .toBe('/var/log');
    expect(resolve('/')).toBe('/');
  });

  it('exposes the node:path-compatible posix surface', () => {
    expect(posix.join).toBe(join);
    expect(posix.resolve).toBe(resolve);
  });
});
