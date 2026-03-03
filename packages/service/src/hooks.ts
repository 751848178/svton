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

  // 为所有非函数属性创建 Hook
  const target = internal.target;
  const proto = Object.getPrototypeOf(target);
  
  // 收集所有非函数属性
  const allKeys = new Set<string | symbol>();
  
  // 从实例收集
  Object.keys(target).forEach(key => {
    if (typeof (target as any)[key] !== 'function') {
      allKeys.add(key);
    }
  });
  
  // 从原型收集（包括 getter）
  Object.getOwnPropertyNames(proto).forEach(key => {
    if (key !== 'constructor') {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor && (descriptor.get || typeof descriptor.value !== 'function')) {
        allKeys.add(key);
      }
    }
  });

  allKeys.forEach((key) => {
    (hooks as any)[key] = () => {
      // 检查是否是 observable
      if (!metadata.observables.has(key)) {
        throw new Error(
          `Property "${String(key)}" is not decorated with @observable. ` +
          `Did you mean to use useDerived.${String(key)}() for a @computed property?`
        );
      }

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

  // 为所有非函数属性创建 Hook
  const target = internal.target;
  const proto = Object.getPrototypeOf(target);
  
  // 收集所有非函数属性
  const allKeys = new Set<string | symbol>();
  
  // 从实例收集
  Object.keys(target).forEach(key => {
    if (typeof (target as any)[key] !== 'function') {
      allKeys.add(key);
    }
  });
  
  // 从原型收集（包括 getter）
  Object.getOwnPropertyNames(proto).forEach(key => {
    if (key !== 'constructor') {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor && (descriptor.get || typeof descriptor.value !== 'function')) {
        allKeys.add(key);
      }
    }
  });

  allKeys.forEach((key) => {
    (hooks as any)[key] = () => {
      // 检查是否是 computed
      if (!metadata.computeds.has(key)) {
        throw new Error(
          `Property "${String(key)}" is not decorated with @computed. ` +
          `Did you mean to use useState.${String(key)}() for an @observable property?`
        );
      }

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

  // 为所有函数属性创建 Hook
  const target = internal.target;
  const proto = Object.getPrototypeOf(target);
  
  // 收集所有函数属性
  const allKeys = new Set<string | symbol>();
  
  // 从原型收集方法
  Object.getOwnPropertyNames(proto).forEach(key => {
    if (key !== 'constructor') {
      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (descriptor && typeof descriptor.value === 'function') {
        allKeys.add(key);
      }
    }
  });

  allKeys.forEach((key) => {
    (hooks as any)[key] = () => {
      // 检查是否是 action
      if (!metadata.actions.has(key)) {
        throw new Error(
          `Method "${String(key)}" is not decorated with @action. ` +
          `Please add @action decorator to use it.`
        );
      }

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
