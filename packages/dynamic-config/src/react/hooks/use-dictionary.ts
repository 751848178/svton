'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDictionaryApi } from '../context';
import type { DictionaryItem, CreateDictionaryInput, UpdateDictionaryInput } from '../../core/types';

/**
 * 获取所有字典
 */
export function useDictionaries() {
  const api = useDictionaryApi();
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.findAll();
      setItems(result);
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
    items,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 根据编码获取字典
 */
export function useDictionaryByCode(code: string) {
  const api = useDictionaryApi();
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.findByCode(code);
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [api, code]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    items,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 获取字典树
 */
export function useDictionaryTree(code: string) {
  const api = useDictionaryApi();
  const [tree, setTree] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getTree(code);
      setTree(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [api, code]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    tree,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * 字典修改 Hook
 */
export function useDictionaryMutation() {
  const api = useDictionaryApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (data: CreateDictionaryInput) => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.create(data);
        return result;
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

  const update = useCallback(
    async (id: number, data: UpdateDictionaryInput) => {
      try {
        setLoading(true);
        setError(null);
        const result = await api.update(id, data);
        return result;
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
    async (id: number) => {
      try {
        setLoading(true);
        setError(null);
        await api.delete(id);
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

  return {
    create,
    update,
    remove,
    loading,
    error,
  };
}
