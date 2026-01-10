import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getMergedMetadata } from './metadata';
import { createInternalInstance } from './instance';
import type {
  ServiceClass,
  ServiceInstance,
  InternalServiceInstance,
  StateHooks,
  DerivedHooks,
  ActionHooks,
} from './types';

/**
 * 创建状态 Hooks
 */
function createStateHooks<T extends object>(
  internal: InternalServiceInstance<T>,
  metadata: ReturnType<typeof getMergedMetadata>,
): StateHooks<T> {
  const hooks = {} as StateHooks<T>;

  metadata.observables.forEach((key) => {
    (hooks as any)[key] = () => {
      const [value, setValue] = useState(() => internal.getState(key as keyof T));

      useEffect(() => {
        // 同步初始值
        setValue(internal.getState(key as keyof T));

        // 订阅变化
        return internal.subscribe(key, () => {
          setValue(internal.getState(key as keyof T));
        });
      }, []);

      return value;
    };
  });

  return hooks;
}

/**
 * 创建计算属性 Hooks
 */
function createDerivedHooks<T extends object>(
  internal: InternalServiceInstance<T>,
  metadata: ReturnType<typeof getMergedMetadata>,
): DerivedHooks<T> {
  const hooks = {} as DerivedHooks<T>;

  metadata.computeds.forEach((key) => {
    (hooks as any)[key] = () => {
      // 获取 computed getter
      const getter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(internal.target),
        key,
      )?.get;

      if (!getter) {
        throw new Error(`Computed property "${String(key)}" not found`);
      }

      // 追踪依赖的 observable
      const [, forceUpdate] = useState({});
      const depsRef = useRef<Set<string | symbol>>(new Set());

      useEffect(() => {
        // 订阅所有 observable（简化实现）
        const unsubscribes: (() => void)[] = [];

        metadata.observables.forEach((obsKey) => {
          const unsub = internal.subscribe(obsKey, () => {
            forceUpdate({});
          });
          unsubscribes.push(unsub);
        });

        return () => {
          unsubscribes.forEach((unsub) => unsub());
        };
      }, []);

      return getter.call(internal.target);
    };
  });

  return hooks;
}

/**
 * 创建 Action Hooks
 */
function createActionHooks<T extends object>(
  internal: InternalServiceInstance<T>,
  metadata: ReturnType<typeof getMergedMetadata>,
): ActionHooks<T> {
  const hooks = {} as ActionHooks<T>;

  metadata.actions.forEach((key) => {
    (hooks as any)[key] = () => {
      const method = (internal.target as any)[key];
      if (typeof method !== 'function') {
        throw new Error(`Action "${String(key)}" is not a function`);
      }

      // 返回绑定了 this 的方法
      return useCallback(
        (...args: any[]) => method.apply(internal.target, args),
        [],
      );
    };
  });

  return hooks;
}

/**
 * 创建 Service 实例包装
 */
export function createServiceWrapper<T extends object>(
  internal: InternalServiceInstance<T>,
  ServiceClass: ServiceClass<T>,
): ServiceInstance<T> {
  const metadata = getMergedMetadata(ServiceClass);

  return {
    useState: createStateHooks(internal, metadata),
    useDerived: createDerivedHooks(internal, metadata),
    useAction: createActionHooks(internal, metadata),
  };
}

/**
 * 创建 Scoped Service Hook
 */
export function createService<T extends object>(
  ServiceClass: ServiceClass<T>,
): () => ServiceInstance<T> {
  return () => {
    // 每次调用创建新实例
    const internalRef = useRef<InternalServiceInstance<T> | null>(null);

    if (!internalRef.current) {
      internalRef.current = createInternalInstance(ServiceClass);
    }

    return useMemo(
      () => createServiceWrapper(internalRef.current!, ServiceClass),
      [],
    );
  };
}
