'use client';

import React, { createContext, useContext } from 'react';
import type { ConfigApiClient, DictionaryApiClient, DynamicConfigProviderProps } from './types';

interface DynamicConfigContextValue {
  configApi: ConfigApiClient;
  dictionaryApi: DictionaryApiClient;
}

const DynamicConfigContext = createContext<DynamicConfigContextValue | null>(null);

/**
 * 动态配置 Provider
 *
 * @example
 * ```tsx
 * const configApi: ConfigApiClient = {
 *   getPublicConfigs: () => fetch('/api/config/public').then(r => r.json()),
 *   // ... 其他方法
 * };
 *
 * const dictionaryApi: DictionaryApiClient = {
 *   findAll: () => fetch('/api/dictionary').then(r => r.json()),
 *   // ... 其他方法
 * };
 *
 * <DynamicConfigProvider configApi={configApi} dictionaryApi={dictionaryApi}>
 *   <App />
 * </DynamicConfigProvider>
 * ```
 */
export function DynamicConfigProvider({
  configApi,
  dictionaryApi,
  children,
}: DynamicConfigProviderProps) {
  return (
    <DynamicConfigContext.Provider value={{ configApi, dictionaryApi }}>
      {children}
    </DynamicConfigContext.Provider>
  );
}

/**
 * 获取配置 API 客户端
 */
export function useConfigApi(): ConfigApiClient {
  const context = useContext(DynamicConfigContext);
  if (!context) {
    throw new Error('useConfigApi must be used within DynamicConfigProvider');
  }
  return context.configApi;
}

/**
 * 获取字典 API 客户端
 */
export function useDictionaryApi(): DictionaryApiClient {
  const context = useContext(DynamicConfigContext);
  if (!context) {
    throw new Error('useDictionaryApi must be used within DynamicConfigProvider');
  }
  return context.dictionaryApi;
}
