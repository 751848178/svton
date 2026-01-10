import type { ServiceClass } from './types';

/**
 * 全局 Service 容器（用于依赖注入）
 */
class ServiceContainer {
  private instances = new Map<ServiceClass, any>();
  private factories = new Map<ServiceClass, () => any>();

  /**
   * 注册 Service 工厂
   */
  register<T>(serviceClass: ServiceClass<T>, factory: () => T): void {
    this.factories.set(serviceClass, factory);
  }

  /**
   * 获取或创建 Service 实例（单例）
   */
  resolve<T>(serviceClass: ServiceClass<T>): T {
    if (this.instances.has(serviceClass)) {
      return this.instances.get(serviceClass);
    }

    const factory = this.factories.get(serviceClass);
    if (factory) {
      const instance = factory();
      this.instances.set(serviceClass, instance);
      return instance;
    }

    // 默认创建新实例
    const instance = new serviceClass();
    this.instances.set(serviceClass, instance);
    return instance;
  }

  /**
   * 检查是否已注册
   */
  has(serviceClass: ServiceClass): boolean {
    return this.instances.has(serviceClass) || this.factories.has(serviceClass);
  }

  /**
   * 清除实例（用于测试）
   */
  clear(): void {
    this.instances.clear();
  }
}

export const container = new ServiceContainer();
