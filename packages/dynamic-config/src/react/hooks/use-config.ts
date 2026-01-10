'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConfigApi } from '../context';
import type { ConfigItem } from '../../core/types';

/**
 * 获取单个配置值
 */
export function useConfig<T = any>(key: string, defaultValue?: T) {
  const api = useConfigApi();
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.get(key);
      setValue(result ?? defaultValue);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [api, key, defaultValue]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const update = useCallback(
    async (newValue: T) => {
      try {
        await api.set(key, newValue);
        setValue(newValue);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [api, key],
  );

  return {
    value,
    loading,
    error,
    refetch: fetch,
    update,
  };
}

/**
 * 获取分类配置
 */
export function useConfigCategory(category: string) {
  const api = useConfigApi();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getByCategory(category);
      setConfigs(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [api, category]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    configs,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 获取公开配置
 */
export function usePublicConfigs() {
  const api = useConfigApi();
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getPublicConfigs();
      setConfigs(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    configs,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 获取系统配置（嵌套结构）
 */
export function useSystemConfig() {
  const api = useConfigApi();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getSystemConfig();
      setConfig(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    config,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 配置修改 Hook
 */
export function useConfigMutation() {
  const api = useConfigApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const set = useCallback(
    async (key: string, value: any) => {
      try {
        setLoading(true);
        setError(null);
        await api.set(key, value);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const batchUpdate = useCallback(
    async (configs: Array<{ key: string; value: any }>) => {
      try {
        setLoading(true);
        setError(null);
        await api.batchUpdate(configs);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const remove = useCallback(
    async (key: string) => {
      try {
        setLoading(true);
        setError(null);
        await api.delete(key);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [api],
  );

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await api.reload();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return {
    set,
    batchUpdate,
    remove,
    reload,
    loading,
    error,
  };
}
