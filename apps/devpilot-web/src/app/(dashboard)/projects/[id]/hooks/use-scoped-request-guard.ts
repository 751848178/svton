'use client';

import { useCallback, useEffect, useRef } from 'react';

export interface ScopedRequestToken {
  scope: string;
  channel: string;
  generation: number;
}

interface GuardState {
  scope: string;
  generations: Map<string, number>;
  active: boolean;
}

export function scopedRequestIdentity(...parts: string[]) {
  return JSON.stringify(parts);
}

export function useScopedRequestGuard(scope: string) {
  const guardRef = useRef<GuardState>({ scope, generations: new Map(), active: true });
  if (guardRef.current.scope !== scope) {
    guardRef.current = { scope, generations: new Map(), active: true };
  }

  useEffect(() => {
    if (guardRef.current.scope === scope) guardRef.current.active = true;
    return () => {
      if (guardRef.current.scope === scope) guardRef.current.active = false;
    };
  }, [scope]);

  const begin = useCallback(
    (channel = 'default'): ScopedRequestToken => {
      const guard = guardRef.current;
      if (!guard.active || guard.scope !== scope) return { scope, channel, generation: -1 };
      const generation = (guard.generations.get(channel) || 0) + 1;
      guard.generations.set(channel, generation);
      return { scope, channel, generation };
    },
    [scope],
  );

  const isCurrent = useCallback((token: ScopedRequestToken) => {
    const guard = guardRef.current;
    return (
      token.generation >= 0 &&
      guard.active &&
      guard.scope === token.scope &&
      guard.generations.get(token.channel) === token.generation
    );
  }, []);

  const invalidate = useCallback(
    (channel = 'default') => {
      const guard = guardRef.current;
      if (!guard.active || guard.scope !== scope) return;
      guard.generations.set(channel, (guard.generations.get(channel) || 0) + 1);
    },
    [scope],
  );

  return { begin, invalidate, isCurrent };
}
