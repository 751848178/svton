import { resolveTask } from '../commands/lifecycle';
import { toPascalCase, normalizeModuleName } from '../commands/generate';

describe('lifecycle task mapping', () => {
  it('aliases typecheck to the hyphenated turbo task', () => {
    expect(resolveTask('typecheck')).toBe('type-check');
  });

  it('passes other tasks through unchanged', () => {
    expect(resolveTask('dev')).toBe('dev');
    expect(resolveTask('build')).toBe('build');
    expect(resolveTask('lint')).toBe('lint');
    expect(resolveTask('type-check')).toBe('type-check');
  });
});

describe('generate naming helpers', () => {
  it('converts kebab/lower names to PascalCase', () => {
    expect(toPascalCase('users')).toBe('Users');
    expect(toPascalCase('user-profile')).toBe('UserProfile');
    expect(toPascalCase('order_item')).toBe('OrderItem');
  });

  it('normalizes module names to lowercase kebab', () => {
    expect(normalizeModuleName('Users')).toBe('users');
    expect(normalizeModuleName('User Profile')).toBe('user-profile');
    expect(normalizeModuleName('foo/bar')).toBe('foobar');
  });
});
