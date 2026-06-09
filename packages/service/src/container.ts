import { ServiceFactoryRegistry, ServiceScope } from './scope';
import type { ServiceClass } from './types';

/**
 * 全局 Service 容器（用于依赖注入）
 */
class ServiceContainer {
  private readonly registry = new ServiceFactoryRegistry();
  private readonly globalScope = new ServiceScope(this.registry);

  /**
   * 注册 Service 工厂
   */
  register<T extends object>(serviceClass: ServiceClass<T>, factory: () => T): void {
    this.registry.register(serviceClass, factory);
  }

  /**
   * 获取或创建 Service 实例（单例）
   */
  resolve<T extends object>(serviceClass: ServiceClass<T>): T {
    return this.globalScope.resolveInternal(serviceClass).target;
  }

  /**
   * 检查是否已注册
   */
  has(serviceClass: ServiceClass): boolean {
    return this.globalScope.has(serviceClass) || this.registry.has(serviceClass);
  }

  /**
   * 清除实例（用于测试）
   */
  clear(): void {
    this.globalScope.clear();
  }

  /**
   * 创建新的局部作用域
   */
  createScope(parent?: ServiceScope): ServiceScope {
    return new ServiceScope(this.registry, parent);
  }
}

export const container = new ServiceContainer();
