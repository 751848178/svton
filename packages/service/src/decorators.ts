import 'reflect-metadata';
import { getServiceMetadata } from './metadata';
import type { ServiceClass } from './types';
import { isAbortSignal } from '@svton/api-client/abort';

/**
 * Service 装饰器选项
 */
export interface ServiceOptions {
  name?: string;
}

/**
 * @Service() 装饰器
 * 标记一个类为 Service
 *
 * @example
 * ```typescript
 * @Service()
 * class UserService {
 *   // ...
 * }
 * ```
 */
export function Service(options: ServiceOptions = {}): ClassDecorator {
  return (target) => {
    const metadata = getServiceMetadata(target as unknown as ServiceClass);
    metadata.name = options.name || target.name;
  };
}

/**
 * @observable() 装饰器
 * 标记属性为响应式状态
 *
 * @example
 * ```typescript
 * @observable()
 * count = 0;
 * ```
 */
export function observable(): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    const constructor = target.constructor as ServiceClass;
    const metadata = getServiceMetadata(constructor);
    metadata.observables.add(propertyKey);
  };
}

/**
 * @computed() 装饰器
 * 标记 getter 为计算属性
 *
 * @example
 * ```typescript
 * @computed()
 * get doubled() {
 *   return this.count * 2;
 * }
 * ```
 */
export function computed(): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const constructor = target.constructor as ServiceClass;
    const metadata = getServiceMetadata(constructor);
    metadata.computed.add(propertyKey);
    return descriptor;
  };
}

/**
 * @action() 装饰器
 * 标记方法为 action，自动支持 async 和 generator 函数
 *
 * - async 函数：正常执行
 * - generator 函数：自动执行，请求失败时静默停止（不抛出错误）
 *
 * @example
 * ```typescript
 * // Async 函数
 * @action()
 * async loadUser(id: number) {
 *   const user = await apiAsync('GET:/users/:id', { id });
 *   this.user = user;
 * }
 *
 * // Generator 函数（推荐用于复杂流程）
 * @action()
 * *loadUserData(id: number) {
 *   // 请求失败会静默停止，不会执行后续代码，也不会抛出错误
 *   const user = yield* api('GET:/users/:id', { id });
 *   this.user = user;
 *
 *   // 只有上面成功，这里才会执行
 *   const posts = yield* api('GET:/users/:id/posts', { id });
 *   this.posts = posts;
 * }
 * ```
 */
export function action(): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const constructor = target.constructor as ServiceClass;
    const metadata = getServiceMetadata(constructor);
    metadata.actions.add(propertyKey);

    const originalMethod = descriptor.value;

    // 检查是否是 generator 函数
    if (originalMethod && originalMethod.constructor.name === 'GeneratorFunction') {
      // 包装 generator 函数，自动执行
      descriptor.value = function (this: any, ...args: any[]) {
        const generator = originalMethod.apply(this, args);
        return runGeneratorSilently(generator);
      };
    }
    // async 函数和普通函数保持不变

    return descriptor;
  };
}

/**
 * 执行 Generator 函数（静默模式）
 *
 * 当 API 请求失败时，Generator 会静默停止执行，不会抛出错误
 * 这样在 Service 的 action 中就不需要 try-catch
 */
async function runGeneratorSilently<R>(
  generator: Generator<Promise<any>, R, any>
): Promise<R | undefined> {
  let result = generator.next();

  while (!result.done) {
    const value = await result.value;

    // 检查是否是中止信号
    if (isAbortSignal(value)) {
      // 静默停止，不抛出错误
      if (generator.return) {
        generator.return(undefined as any);
      }
      return undefined;
    }

    result = generator.next(value);
  }

  return result.value;
}

/**
 * @Inject() 装饰器
 * 注入其他 Service（自动推断类型）
 *
 * @example
 * ```typescript
 * @Inject()
 * userService!: UserService;
 *
 * // 或指定类型
 * @Inject(UserService)
 * userService!: UserService;
 * ```
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
