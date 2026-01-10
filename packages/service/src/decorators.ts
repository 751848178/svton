import 'reflect-metadata';
import { getServiceMetadata } from './metadata';
import type { ServiceClass } from './types';

/**
 * Service 装饰器选项
 */
export interface ServiceOptions {
  name?: string;
}

/**
 * @Service 装饰器
 * 标记一个类为 Service
 */
export function Service(options: ServiceOptions = {}): ClassDecorator {
  return (target) => {
    const metadata = getServiceMetadata(target as unknown as ServiceClass);
    metadata.name = options.name || target.name;
  };
}

/**
 * @observable 装饰器
 * 标记属性为响应式状态
 */
export function observable(target: any, propertyKey: string | symbol): void {
  const constructor = target.constructor as ServiceClass;
  const metadata = getServiceMetadata(constructor);
  metadata.observables.add(propertyKey);
}

/**
 * @computed 装饰器
 * 标记 getter 为计算属性
 */
export function computed(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const constructor = target.constructor as ServiceClass;
  const metadata = getServiceMetadata(constructor);
  metadata.computeds.add(propertyKey);
  return descriptor;
}

/**
 * @action 装饰器
 * 标记方法为 action
 */
export function action(
  target: any,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  const constructor = target.constructor as ServiceClass;
  const metadata = getServiceMetadata(constructor);
  metadata.actions.add(propertyKey);
  return descriptor;
}

/**
 * @Inject 装饰器
 * 注入其他 Service（自动推断类型）
 */
export function Inject(): PropertyDecorator;
export function Inject(serviceClass: ServiceClass): PropertyDecorator;
export function Inject(serviceClass?: ServiceClass): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const constructor = target.constructor as ServiceClass;
    const metadata = getServiceMetadata(constructor);

    // 自动推断类型
    let targetClass = serviceClass;
    if (!targetClass) {
      targetClass = Reflect.getMetadata('design:type', target, propertyKey);
    }

    if (targetClass) {
      metadata.injects.set(propertyKey, targetClass);
    }
  };
}
