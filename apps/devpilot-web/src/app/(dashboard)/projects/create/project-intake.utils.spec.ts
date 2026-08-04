import { deriveProjectName } from './project-intake.utils';

describe('project intake helpers', () => {
  it('derives a project name from HTTPS and SSH repositories', () => {
    expect(deriveProjectName('https://github.com/acme/payments.git')).toBe('payments');
    expect(deriveProjectName('git@github.com:acme/console.git')).toBe('console');
  });
});
