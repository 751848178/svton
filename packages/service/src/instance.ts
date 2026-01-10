import { getMergedMetadata } from './metadata';
import { container } from './container';
import type { ServiceClass, InternalServiceInstance, Subscriber } from './types';

/**
 * 创建内部 Service 实例
 */
export function createInternalInstance<T extends object>(
  ServiceClass: ServiceClass<T>,
): InternalServiceInstance<T> {
  const metadata = getMergedMetadata(ServiceClass);
  const target = new ServiceClass();

  // 处理依赖注入
  metadata.injects.forEach((InjectClass, key) => {
    const injectedInstance = container.resolve(InjectClass);
    (target as any)[key] = injectedInstance;
  });

  const subscribers = new Map<string | symbol, Set<Subscriber>>();

  const instance: InternalServiceInstance<T> = {
    target,
    subscribers,

    notify(key: string | symbol) {
      const subs = subscribers.get(key);
      if (subs) {
        subs.forEach((callback) => callback());
      }
    },

    subscribe(key: string | symbol, callback: Subscriber) {
      if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
      }
      subscribers.get(key)!.add(callback);

      return () => {
        subscribers.get(key)?.delete(callback);
      };
    },

    getState<K extends keyof T>(key: K): T[K] {
      return target[key];
    },

    setState<K extends keyof T>(key: K, value: T[K]) {
      if (target[key] !== value) {
        target[key] = value;
        instance.notify(key as string | symbol);
      }
    },
  };

  // 代理 observable 属性
  metadata.observables.forEach((key) => {
    const privateKey = `__${String(key)}__`;
    (target as any)[privateKey] = (target as any)[key];

    Object.defineProperty(target, key, {
      get() {
        return (target as any)[privateKey];
      },
      set(value) {
        if ((target as any)[privateKey] !== value) {
          (target as any)[privateKey] = value;
          instance.notify(key);
        }
      },
      enumerable: true,
      configurable: true,
    });
  });

  // 代理 computed 属性（触发依赖追踪）
  metadata.computeds.forEach((key) => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(target),
      key,
    );
    if (originalDescriptor?.get) {
      // computed 的订阅在 useDerived 中处理
    }
  });

  return instance;
}
