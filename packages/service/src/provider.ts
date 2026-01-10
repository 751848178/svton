import React, {
  createContext,
  useContext,
  useRef,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react';
import { getMergedMetadata } from './metadata';
import { createInternalInstance } from './instance';
import { createServiceWrapper } from './hooks';
import type {
  ServiceClass,
  ServiceInstance,
  ServiceProvider,
  InternalServiceInstance,
  ProviderProps,
} from './types';

/**
 * 创建 Service Provider
 */
export function createServiceProvider<T extends object>(
  ServiceClass: ServiceClass<T>,
): ServiceProvider<T> {
  const metadata = getMergedMetadata(ServiceClass);
  const serviceName = metadata.name || ServiceClass.name;

  // 创建 Context
  const ServiceContext = createContext<InternalServiceInstance<T> | null>(null);
  ServiceContext.displayName = `${serviceName}Context`;

  // Provider 组件
  const Provider = ({ children }: ProviderProps): JSX.Element => {
    const internalRef = useRef<InternalServiceInstance<T> | null>(null);

    if (!internalRef.current) {
      internalRef.current = createInternalInstance(ServiceClass);
    }

    return React.createElement(
      ServiceContext.Provider,
      { value: internalRef.current },
      children,
    );
  };

  Provider.displayName = `${serviceName}Provider`;

  // useService Hook
  const useService = (): ServiceInstance<T> => {
    const internal = useContext(ServiceContext);

    if (!internal) {
      throw new Error(
        `useService must be used within <${serviceName}Provider>. ` +
          `Make sure to wrap your component with <${serviceName}Provider>.`,
      );
    }

    return useMemo(
      () => createServiceWrapper(internal, ServiceClass),
      [internal],
    );
  };

  // HOC provide 方法
  const provide = <P extends object>(
    Component: ComponentType<P>,
  ): ComponentType<P> => {
    const WrappedComponent = (props: P) => {
      return React.createElement(
        Provider,
        null,
        React.createElement(Component, props),
      );
    };

    WrappedComponent.displayName = `${serviceName}Provider(${
      Component.displayName || Component.name || 'Component'
    })`;

    return WrappedComponent;
  };

  // 组合 Provider
  const ServiceProvider = Provider as ServiceProvider<T>;
  ServiceProvider.useService = useService;
  ServiceProvider.provide = provide;
  ServiceProvider.displayName = `${serviceName}Provider`;

  return ServiceProvider;
}
