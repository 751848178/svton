import { describe, it, expect } from 'vitest';
import { PromptManager } from '@svton/agent-core';

describe('PromptManager template rendering', () => {
  it('matches variable keys as literal placeholders', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'literal-keys',
      description: 'Template with regex-looking variable keys',
      template: [
        'User: {{user.name}}',
        'Similar: {{userXname}}',
        'Path: {{path[0]}}',
      ].join('\n'),
      variables: ['user.name', 'path[0]'],
    });

    const result = pm.renderTemplate('literal-keys', [
      { key: 'user.name', value: 'Alice' },
      { key: 'path[0]', value: '/tmp/file.txt' },
    ]);

    expect(result).toBe([
      'User: Alice',
      'Similar: {{userXname}}',
      'Path: /tmp/file.txt',
    ].join('\n'));
  });
});
