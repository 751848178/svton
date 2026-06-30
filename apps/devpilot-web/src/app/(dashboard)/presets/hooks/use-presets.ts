/**
 * 预设数据 Hook
 *
 * 单一职责：预设的增删改查与导入导出。
 *
 * 列表走 SWR（useQueryLoose），支持 initialPresets（首屏 server 数据透传）。
 * 写操作后调用 mutate 刷新缓存。
 */

import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { Preset, PresetInput, PresetImport } from '../types';

const PRESETS_KEY = 'GET:/presets';

export function usePresets(initialPresets?: Preset[]) {
  const { data, isLoading } = useQueryLoose<Preset[]>(PRESETS_KEY, { fallback: initialPresets });
  const presets = data ?? [];

  const fetchConfig = usePersistFn(async (id: string) => {
    const preset = await apiRequest<{ config: unknown }>(`GET:/presets/${id}`);
    return preset.config;
  });

  const create = usePersistFn(async (input: PresetInput) => {
    await apiRequest('POST:/presets', input);
    await mutate(PRESETS_KEY);
  });

  const remove = usePersistFn(async (id: string) => {
    await apiRequest(`DELETE:/presets/${id}`);
    await mutate(PRESETS_KEY);
  });

  const importPreset = usePersistFn(async (input: PresetImport) => {
    await apiRequest('POST:/presets/import', input);
    await mutate(PRESETS_KEY);
  });

  const exportPreset = usePersistFn(async (id: string) => {
    return apiRequest<Record<string, unknown>>(`GET:/presets/${id}/export`);
  });

  return { presets, isLoading, fetchConfig, create, remove, importPreset, exportPreset };
}
