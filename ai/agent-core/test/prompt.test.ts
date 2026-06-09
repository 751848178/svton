import { describe, it, expect } from 'vitest';
import {
  PromptManager,
  type PromptTemplate,
  type PromptVariable,
  type ToolDefinition,
} from '@svton/agent-core';

// Helpers
const makeTool = (overrides: Partial<ToolDefinition> = {}): ToolDefinition => ({
  name: 'test_tool',
  description: 'A test tool',
  parameters: { type: 'object', properties: {} },
  ...overrides,
});

// ============================================================
// compose - default template
// ============================================================
describe('PromptManager - compose default template', () => {
  it('returns default template when no options provided', () => {
    const pm = new PromptManager();
    const result = pm.compose({});
    expect(result).toContain('You are an intelligent AI assistant');
    expect(result).toContain('## Guidelines');
    expect(result).toContain('Think carefully before acting');
  });

  it('returns default template when options is undefined', () => {
    const pm = new PromptManager();
    // compose requires an argument, but an empty object triggers defaults
    const result = pm.compose({});
    expect(result).toContain('You are an intelligent AI assistant');
  });

  it('uses custom baseTemplate when provided', () => {
    const pm = new PromptManager();
    const result = pm.compose({ baseTemplate: 'Custom system prompt here.' });
    expect(result).toContain('Custom system prompt here.');
    expect(result).not.toContain('You are an intelligent AI assistant');
  });
});

// ============================================================
// compose - tools
// ============================================================
describe('PromptManager - compose with tools', () => {
  it('includes tool descriptions in the output', () => {
    const pm = new PromptManager();
    const tools: ToolDefinition[] = [
      makeTool({ name: 'file_read', description: 'Read file contents' }),
      makeTool({ name: 'bash', description: 'Execute shell commands' }),
    ];

    const result = pm.compose({ tools });
    expect(result).toContain('## Available Tools');
    expect(result).toContain('file_read');
    expect(result).toContain('Read file contents');
    expect(result).toContain('bash');
    expect(result).toContain('Execute shell commands');
  });

  it('formats tool names in bold', () => {
    const pm = new PromptManager();
    const tools = [makeTool({ name: 'grep', description: 'Search files' })];
    const result = pm.compose({ tools });
    expect(result).toContain('**grep**');
  });

  it('does not include tools section when tools array is empty', () => {
    const pm = new PromptManager();
    const result = pm.compose({ tools: [] });
    expect(result).not.toContain('## Available Tools');
  });

  it('does not include tools section when tools is undefined', () => {
    const pm = new PromptManager();
    const result = pm.compose({});
    expect(result).not.toContain('## Available Tools');
  });

  it('includes read-only annotation', () => {
    const pm = new PromptManager();
    const tools: ToolDefinition[] = [
      makeTool({
        name: 'file_read',
        description: 'Read files',
        annotations: { readOnlyHint: true },
      }),
    ];
    const result = pm.compose({ tools });
    expect(result).toContain('read-only');
  });

  it('includes destructive annotation', () => {
    const pm = new PromptManager();
    const tools: ToolDefinition[] = [
      makeTool({
        name: 'file_delete',
        description: 'Delete files',
        annotations: { destructiveHint: true },
      }),
    ];
    const result = pm.compose({ tools });
    expect(result).toContain('destructive');
  });

  it('includes both annotations when both are set', () => {
    const pm = new PromptManager();
    const tools: ToolDefinition[] = [
      makeTool({
        name: 'multi',
        description: 'Multi tool',
        annotations: { readOnlyHint: true, destructiveHint: true },
      }),
    ];
    const result = pm.compose({ tools });
    expect(result).toContain('read-only');
    expect(result).toContain('destructive');
  });

  it('does not show annotation section when no annotations exist', () => {
    const pm = new PromptManager();
    const tools = [makeTool({ name: 'plain', description: 'No annotations' })];
    const result = pm.compose({ tools });
    // Should contain bold name without parentheses for annotations
    expect(result).toContain('- **plain**: No annotations');
  });
});

// ============================================================
// compose - skillsSummary
// ============================================================
describe('PromptManager - compose with skillsSummary', () => {
  it('includes skills section when skillsSummary provided', () => {
    const pm = new PromptManager();
    const result = pm.compose({ skillsSummary: 'Available skills: coding, debugging' });
    expect(result).toContain('## Skills');
    expect(result).toContain('Available skills: coding, debugging');
  });

  it('does not include skills section when skillsSummary is undefined', () => {
    const pm = new PromptManager();
    const result = pm.compose({});
    expect(result).not.toContain('## Skills');
  });

  it('does not include skills section when skillsSummary is empty string', () => {
    const pm = new PromptManager();
    const result = pm.compose({ skillsSummary: '' });
    expect(result).not.toContain('## Skills');
  });
});

// ============================================================
// compose - memoryNotes
// ============================================================
describe('PromptManager - compose with memoryNotes', () => {
  it('includes context section when memoryNotes provided', () => {
    const pm = new PromptManager();
    const result = pm.compose({ memoryNotes: 'User prefers TypeScript' });
    expect(result).toContain('## Context');
    expect(result).toContain('User prefers TypeScript');
  });

  it('does not include context section when memoryNotes is undefined', () => {
    const pm = new PromptManager();
    const result = pm.compose({});
    expect(result).not.toContain('## Context');
  });

  it('does not include context section when memoryNotes is empty string', () => {
    const pm = new PromptManager();
    const result = pm.compose({ memoryNotes: '' });
    expect(result).not.toContain('## Context');
  });
});

// ============================================================
// addInstructions / clearInstructions
// ============================================================
describe('PromptManager - addInstructions / clearInstructions', () => {
  it('adds custom instructions section', () => {
    const pm = new PromptManager();
    pm.addInstructions('Always use TypeScript');
    const result = pm.compose({});
    expect(result).toContain('## Additional Instructions');
    expect(result).toContain('Always use TypeScript');
  });

  it('adds multiple instruction blocks', () => {
    const pm = new PromptManager();
    pm.addInstructions('Rule one');
    pm.addInstructions('Rule two');
    const result = pm.compose({});
    expect(result).toContain('Rule one');
    expect(result).toContain('Rule two');
  });

  it('clears all custom instructions', () => {
    const pm = new PromptManager();
    pm.addInstructions('Temporary rule');
    pm.clearInstructions();
    const result = pm.compose({});
    expect(result).not.toContain('## Additional Instructions');
    expect(result).not.toContain('Temporary rule');
  });

  it('instructions persist across multiple compose calls', () => {
    const pm = new PromptManager();
    pm.addInstructions('Persistent rule');
    const result1 = pm.compose({});
    const result2 = pm.compose({});
    expect(result1).toContain('Persistent rule');
    expect(result2).toContain('Persistent rule');
  });

  it('can add instructions after clearing', () => {
    const pm = new PromptManager();
    pm.addInstructions('First');
    pm.clearInstructions();
    pm.addInstructions('Second');
    const result = pm.compose({});
    expect(result).not.toContain('First');
    expect(result).toContain('Second');
  });
});

// ============================================================
// compose - full composition
// ============================================================
describe('PromptManager - compose full composition', () => {
  it('combines all sections in order', () => {
    const pm = new PromptManager();
    pm.addInstructions('Custom instruction');

    const result = pm.compose({
      tools: [makeTool({ name: 'tool1', description: 'Tool one' })],
      skillsSummary: 'Skill summary',
      memoryNotes: 'Memory notes',
    });

    const baseIdx = result.indexOf('You are an intelligent AI assistant');
    const toolsIdx = result.indexOf('## Available Tools');
    const skillsIdx = result.indexOf('## Skills');
    const contextIdx = result.indexOf('## Context');
    const instrIdx = result.indexOf('## Additional Instructions');

    expect(baseIdx).toBeGreaterThan(-1);
    expect(toolsIdx).toBeGreaterThan(-1);
    expect(skillsIdx).toBeGreaterThan(-1);
    expect(contextIdx).toBeGreaterThan(-1);
    expect(instrIdx).toBeGreaterThan(-1);

    // Verify ordering
    expect(baseIdx).toBeLessThan(toolsIdx);
    expect(toolsIdx).toBeLessThan(skillsIdx);
    expect(skillsIdx).toBeLessThan(contextIdx);
    expect(contextIdx).toBeLessThan(instrIdx);
  });
});

// ============================================================
// renderTemplate
// ============================================================
describe('PromptManager - renderTemplate', () => {
  it('replaces {{key}} placeholders with values', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'greeting',
      description: 'A greeting template',
      template: 'Hello, {{name}}! Welcome to {{place}}.',
      variables: ['name', 'place'],
    });

    const result = pm.renderTemplate('greeting', [
      { key: 'name', value: 'Alice' },
      { key: 'place', value: 'Wonderland' },
    ]);
    expect(result).toBe('Hello, Alice! Welcome to Wonderland.');
  });

  it('replaces all occurrences of the same variable', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'repeat',
      description: 'Template with repeated variables',
      template: '{{x}} and {{x}} again',
      variables: ['x'],
    });

    const result = pm.renderTemplate('repeat', [{ key: 'x', value: 'hello' }]);
    expect(result).toBe('hello and hello again');
  });

  it('leaves unmatched placeholders unchanged', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'partial',
      description: 'Partial match template',
      template: '{{a}} {{b}} {{c}}',
      variables: ['a', 'b', 'c'],
    });

    const result = pm.renderTemplate('partial', [{ key: 'a', value: 'one' }]);
    expect(result).toBe('one {{b}} {{c}}');
  });

  it('throws if template not found', () => {
    const pm = new PromptManager();
    expect(() => pm.renderTemplate('nonexistent', [])).toThrow('Template "nonexistent" not found');
  });

  it('handles empty variables array', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'static',
      description: 'A static template',
      template: 'No variables here.',
    });

    const result = pm.renderTemplate('static', []);
    expect(result).toBe('No variables here.');
  });

  it('handles template with no variable definitions', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'nolist',
      description: 'No variable list',
      template: 'Hello {{who}}',
    });

    const result = pm.renderTemplate('nolist', [{ key: 'who', value: 'World' }]);
    expect(result).toBe('Hello World');
  });
});

// ============================================================
// registerTemplate
// ============================================================
describe('PromptManager - registerTemplate', () => {
  it('registers a template that can be rendered', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'test',
      description: 'Test template',
      template: 'Value: {{val}}',
      variables: ['val'],
    });

    const result = pm.renderTemplate('test', [{ key: 'val', value: '42' }]);
    expect(result).toBe('Value: 42');
  });

  it('overwrites a template with the same name', () => {
    const pm = new PromptManager();
    pm.registerTemplate({
      name: 'dup',
      description: 'First version',
      template: 'Version 1: {{v}}',
      variables: ['v'],
    });
    pm.registerTemplate({
      name: 'dup',
      description: 'Second version',
      template: 'Version 2: {{v}}',
      variables: ['v'],
    });

    const result = pm.renderTemplate('dup', [{ key: 'v', value: 'test' }]);
    expect(result).toBe('Version 2: test');
  });
});
