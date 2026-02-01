'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useProjectConfigStore } from '@/store/project-config';

interface Preset {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function PresetsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { config, loadPreset } = useProjectConfigStore();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadPresets();
    }
  }, [isAuthenticated]);

  const loadPresets = async () => {
    try {
      const data = await api.get<Preset[]>('/presets');
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async (id: string) => {
    try {
      const preset = await api.get<{ config: typeof config }>(`/presets/${id}`);
      loadPreset(preset.config);
      router.push('/projects/new');
    } catch (error) {
      console.error('Failed to load preset:', error);
    }
  };

  const handleExport = async (id: string) => {
    try {
      const data = await api.get<object>(`/presets/${id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preset-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export preset:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个预设吗？')) return;

    try {
      await api.delete(`/presets/${id}`);
      setPresets(presets.filter((p) => p.id !== id));
    } catch (error) {
      console.error('Failed to delete preset:', error);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/presets/import', { name: data.name, config: data.config });
      loadPresets();
    } catch (error) {
      console.error('Failed to import preset:', error);
      alert('导入失败，请检查文件格式');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">请先登录</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">配置预设</h1>
          <p className="text-muted-foreground">
            保存和管理你的项目配置预设
          </p>
        </div>
        <div className="flex gap-2">
          <label className="px-4 py-2 border rounded-md font-medium hover:bg-accent transition-colors cursor-pointer">
            导入
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            保存当前配置
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-muted-foreground mb-4">还没有保存任何预设</p>
          <button
            onClick={() => setShowSaveModal(true)}
            className="text-primary hover:underline"
          >
            保存第一个预设
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div>
                <h3 className="font-medium">{preset.name}</h3>
                <p className="text-sm text-muted-foreground">
                  更新于 {new Date(preset.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoad(preset.id)}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                >
                  加载
                </button>
                <button
                  onClick={() => handleExport(preset.id)}
                  className="px-3 py-1 text-sm border rounded hover:bg-accent transition-colors"
                >
                  导出
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  className="px-3 py-1 text-sm text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSaveModal && (
        <SavePresetModal
          config={config}
          onClose={() => setShowSaveModal(false)}
          onSuccess={() => {
            setShowSaveModal(false);
            loadPresets();
          }}
        />
      )}
    </div>
  );
}

function SavePresetModal({
  config,
  onClose,
  onSuccess,
}: {
  config: object;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post('/presets', { name, config });
      onSuccess();
    } catch (error) {
      console.error('Failed to save preset:', error);
      alert('保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">保存预设</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">预设名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="如：电商项目模板"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
