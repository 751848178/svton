import type { ComponentType, ReactNode } from 'react';

/**
 * Service 类构造函数类型
 */
export type ServiceClass<T = any> = new () => T;

/**
 * Service 元数据
 */
export interface ServiceMetadata {
  name?: string;
  observables: Set<string | symbol>;
  computeds: Set<string | symbol>;
  actions: Set<string | symbol>;
  injects: Map<string | symbol, ServiceClass>;
}

/**
 * Service 实例接口
 */
export interface ServiceInstance<T> {
  useState: StateHooks<T>;
  useDerived: DerivedHooks<T>;
  useAction: ActionHooks<T>;
}

/**
 * 状态 Hooks 类型
 */
export type StateHooks<T> = {
  [K in ObservableKeys<T>]: () => T[K];
};

/**
 * 计算属性 Hooks 类型
 */
export type DerivedHooks<T> = {
  [K in ComputedKeys<T>]: () => ComputedReturnType<T, K>;
};

/**
 * Action Hooks 类型
 */
export type ActionHooks<T> = {
  [K in ActionKeys<T>]: () => T[K];
};

/**
 * 获取 observable 属性键
 */
export type ObservableKeys<T> = {
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/**
 * 获取 computed getter 键
 */
export type ComputedKeys<T> = {
  [K in keyof T]: T[K] extends Function
    ? K extends `get${string}`
      ? never
      : never
    : never;
}[keyof T] & string;

/**
 * 获取 action 方法键
 */
export type ActionKeys<T> = {
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

/**
 * 获取 computed 返回类型
 */
export type ComputedReturnType<T, K extends keyof T> = T[K] extends () => infer R ? R : T[K];

/**
 * Provider 组件 Props
 */
export interface ProviderProps {
  children: ReactNode;
}

/**
 * Service Provider 接口
 */
export interface ServiceProvider<T> {
  (props: ProviderProps): JSX.Element;
  provide<P extends object>(Component: ComponentType<P>): ComponentType<P>;
  useService(): ServiceInstance<T>;
  displayName?: string;
}

/**
 * 订阅回调
 */
export type Subscriber = () => void;

/**
 * 内部 Service 实例
 */
export interface InternalServiceInstance<T = any> {
  target: T;
  subscribers: Map<string | symbol, Set<Subscriber>>;
  notify(key: string | symbol): void;
  subscribe(key: string | symbol, callback: Subscriber): () => void;
  getState<K extends keyof T>(key: K): T[K];
  setState<K extends keyof T>(key: K, value: T[K]): void;
}
