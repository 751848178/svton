import type { ModelKey } from '@svton/agent-client';
import { E2E_FLAG_KEY } from './e2e-constants';

interface ModelSwitchE2eFlag {
  modelPrepareDelays?: Record<string, number>;
  modelPrepareFailures?: string[];
  modelPersistenceFailures?: number;
}

function readFlag(): ModelSwitchE2eFlag | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(E2E_FLAG_KEY);
    return raw ? JSON.parse(raw) as ModelSwitchE2eFlag : null;
  } catch {
    return null;
  }
}

export async function applyE2eModelPrepareBehavior(key: ModelKey): Promise<void> {
  const flag = readFlag();
  if (!flag) return;
  const delay = flag.modelPrepareDelays?.[key.modelId] ?? 0;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  if (flag.modelPrepareFailures?.includes(key.modelId)) {
    throw new Error(`E2E 模型准备失败：${key.providerId}/${key.modelId}`);
  }
}

export function consumeE2eModelPersistenceFailure(): void {
  const flag = readFlag();
  const remaining = flag?.modelPersistenceFailures ?? 0;
  if (!flag || remaining <= 0) return;
  localStorage.setItem(E2E_FLAG_KEY, JSON.stringify({
    ...flag,
    modelPersistenceFailures: remaining - 1,
  }));
  throw new Error('E2E 默认模型持久化失败。');
}
