import type { ExecutionKind } from './private-snapshot.js';

export const isRuntimeOnly = (kind?: ExecutionKind) => kind === 'config-only' || kind === 'rollback';
