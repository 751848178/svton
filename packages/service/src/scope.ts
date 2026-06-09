import { createInternalInstance } from './instance';
import type { InternalServiceInstance, ServiceClass } from './types';

type ServiceFactory<T extends object> = () => T;

/**
 * Service 工厂注册表
 */
export class ServiceFactoryRegistry {
  private factories = new Map<ServiceClass, ServiceFactory<any>>();

  register<T extends object>(serviceClass: ServiceClass<T>, factory: ServiceFactory<T>): void {
    this.factories.set(serviceClass, factory);
  }

  getFactory<T extends object>(serviceClass: ServiceClass<T>): ServiceFactory<T> | undefined {
    return this.factories.get(serviceClass);
  }

  has(serviceClass: ServiceClass): boolean {
    return this.factories.has(serviceClass);
  }
}

/**
 * Service 作用域
 *
 * - 当前作用域优先复用自己的实例
 * - 如果父作用域里已经有实例，则复用父作用域实例
 * - 否则在当前作用域创建新实例
 */
export class ServiceScope {
  private readonly instances = new Map<ServiceClass, InternalServiceInstance<any>>();

  constructor(
    private readonly registry: ServiceFactoryRegistry,
    private readonly parent?: ServiceScope,
  ) {}

  hasOwn(serviceClass: ServiceClass): boolean {
    return this.instances.has(serviceClass);
  }

  has(serviceClass: ServiceClass): boolean {
    return this.hasOwn(serviceClass) || this.parent?.has(serviceClass) === true;
  }

  findInternal<T extends object>(
    serviceClass: ServiceClass<T>,
  ): InternalServiceInstance<T> | undefined {
    const current = this.instances.get(serviceClass) as InternalServiceInstance<T> | undefined;
    if (current) {
      return current;
    }

    return this.parent?.findInternal(serviceClass);
  }

  ensureOwnInternal<T extends object>(serviceClass: ServiceClass<T>): InternalServiceInstance<T> {
    const existing = this.instances.get(serviceClass) as InternalServiceInstance<T> | undefined;
    if (existing) {
      return existing;
    }

    const target = this.instantiate(serviceClass);
    const internal = createInternalInstance(serviceClass, this, target);
    this.instances.set(serviceClass, internal);
    return internal;
  }

  resolveInternal<T extends object>(serviceClass: ServiceClass<T>): InternalServiceInstance<T> {
    const existing = this.instances.get(serviceClass) as InternalServiceInstance<T> | undefined;
    if (existing) {
      return existing;
    }

    const inherited = this.parent?.findInternal(serviceClass);
    if (inherited) {
      return inherited;
    }

    return this.ensureOwnInternal(serviceClass);
  }

  clear(): void {
    this.instances.clear();
  }

  private instantiate<T extends object>(serviceClass: ServiceClass<T>): T {
    const factory = this.registry.getFactory(serviceClass);
    if (factory) {
      return factory();
    }

    return new serviceClass();
  }
}
