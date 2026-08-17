import type {
  IToolExecutor,
  SvtonToolDefinition,
  ToolCall,
  ToolContext,
  ToolRegistry,
} from '@svton/agent-core';

const definition: SvtonToolDefinition = {
  name: 'e2e_command',
  description: 'Deterministic command lifecycle fixture for product E2E only.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string' },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
      exitCode: { type: 'number' },
      durationMs: { type: 'number' },
      progressText: { type: 'string' },
      apiKey: { type: 'string' },
      password: { type: 'string' },
      accessToken: { type: 'string' },
    },
    required: ['command'],
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const approvalDefinition: SvtonToolDefinition = {
  ...definition,
  name: 'e2e_approval',
  description: 'Deterministic approval fixture for product E2E only.',
};

const fileDefinition: SvtonToolDefinition = {
  name: 'file_edit',
  description: 'Deterministic file outcome fixture for product E2E only.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      diff: { type: 'string' },
    },
    required: ['path', 'diff'],
  },
  annotations: { readOnlyHint: false, idempotentHint: true },
};

const fileReadDefinition: SvtonToolDefinition = {
  name: 'file_read',
  description: 'Deterministic reference fixture for product E2E only.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      offset: { type: 'number' },
      content: { type: 'string' },
    },
    required: ['path'],
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
};

const listFilesDefinition: SvtonToolDefinition = {
  name: 'list_files',
  description: 'Deterministic file-tree input fixture for product E2E only.',
  parameters: {
    type: 'object',
    properties: { tree: { type: 'array', items: { type: 'object' } } },
    required: ['tree'],
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
};

class E2eCommandExecutor implements IToolExecutor {
  async execute(call: ToolCall, context: ToolContext) {
    const args = call.arguments;
    const command = readString(args.command) ?? 'e2e-command';
    const stdout = readString(args.stdout) ?? '';
    const stderr = readString(args.stderr) ?? '';
    const exitCode = readNumber(args.exitCode) ?? 0;
    const durationMs = readNumber(args.durationMs);
    const progressText = readString(args.progressText) ?? 'fixture update';
    const startedAt = Date.now();
    context.onProgress?.(`${progressText} one`);
    await waitForPaint(context.signal);
    context.onProgress?.(`${progressText} two`);
    await waitForPaint(context.signal);
    const output = [stdout, stderr].filter(Boolean).join('\n') || '(no output)';
    return {
      callId: call.id,
      output,
      isError: exitCode !== 0,
      metadata: {
        command,
        cwd: context.workingDir,
        stdout,
        stderr,
        exitCode,
        timedOut: false,
        durationMs: durationMs ?? Date.now() - startedAt,
      },
    };
  }
}

class E2eFileExecutor implements IToolExecutor {
  async execute(call: ToolCall, context: ToolContext) {
    const diff = readString(call.arguments.diff) ?? '';
    context.onProgress?.('Preparing deterministic file change');
    await waitForPaint(context.signal);
    context.onProgress?.('Applying deterministic file change');
    await waitForPaint(context.signal);
    return {
      callId: call.id,
      output: diff,
      isError: false,
    };
  }
}

class E2eFileReadExecutor implements IToolExecutor {
  async execute(call: ToolCall) {
    return {
      callId: call.id,
      output: readString(call.arguments.content) ?? 'deterministic reference content',
      isError: false,
    };
  }
}

class E2eListFilesExecutor implements IToolExecutor {
  async execute(call: ToolCall) {
    return {
      callId: call.id,
      output: JSON.stringify(Array.isArray(call.arguments.tree) ? call.arguments.tree : []),
      isError: false,
    };
  }
}

export function registerE2eTimelineTool(registry: ToolRegistry): void {
  registry.register(definition, new E2eCommandExecutor());
  registry.register(approvalDefinition, new E2eCommandExecutor());
  registry.register(fileDefinition, new E2eFileExecutor());
  registry.register(fileReadDefinition, new E2eFileReadExecutor());
  registry.register(listFilesDefinition, new E2eListFilesExecutor());
}

function waitForPaint(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, 500);
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('E2E fixture interrupted', 'AbortError'));
    }, { once: true });
  });
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
