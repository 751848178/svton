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
 * 状态 Hooks 类型
 * 包含所有非函数属性，每个属性对应一个返回该属性值的 Hook
 * 
 * 使用索引签名保留对原始类型的引用，支持 Go to Definition
 */
export type StateHooks<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: () => T[K];
};

/**
 * 计算属性 Hooks 类型
 * 包含所有非函数属性（因为 getter 在类型层面看起来像属性）
 * 每个属性对应一个返回该属性值的 Hook
 * 
 * 使用索引签名保留对原始类型的引用，支持 Go to Definition
 */
export type DerivedHooks<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? never : K]: () => T[K];
};

/**
 * Action Hooks 类型
 * 包含所有函数属性，每个方法对应一个返回该方法的 Hook
 * 
 * 使用索引签名保留对原始类型的引用，支持 Go to Definition
 */
export type ActionHooks<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: () => T[K];
};

/**
 * Service 实例接口
 * 
 * 为了支持 Go to Definition，我们直接引用原始类型 T
 * 这样 IDE 可以追踪到 Service 类的定义
 */
export interface ServiceInstance<T> {
  // 直接引用原始类型，保留类型信息
  readonly __serviceType?: T;
  
  useState: StateHooks<T>;
  useDerived: DerivedHooks<T>;
  useAction: ActionHooks<T>;
}

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
