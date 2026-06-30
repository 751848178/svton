/**
 * CDN 配置表单
 *
 * 单一职责：收集 CDN 配置（提供商/域名/源站/开关）并触发生成。
 */

import type { CDNConfig } from '../types';
import { PROVIDERS } from '../constants';

interface CdnConfigFormProps {
  config: CDNConfig;
  onChange: (patch: Partial<CDNConfig>) => void;
  onGenerate: () => void;
}

export function CdnConfigForm({ config, onChange, onGenerate }: CdnConfigFormProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-white p-6">
      <h2 className="font-semibold text-gray-900">CDN 配置</h2>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">CDN 提供商</label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.value}
              onClick={() => onChange({ provider: p.value })}
              className={`rounded-lg border p-3 text-left ${
                config.provider === p.value ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="mr-2 text-xl">{p.icon}</span>
              <span className="text-sm font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">CDN 域名</span>
        <input
          type="text"
          value={config.domain}
          onChange={(e) => onChange({ domain: e.target.value })}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="cdn.example.com"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">源站域名</span>
        <input
          type="text"
          value={config.originDomain}
          onChange={(e) => onChange({ originDomain: e.target.value })}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="origin.example.com"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">源站路径</span>
        <input
          type="text"
          value={config.originPath}
          onChange={(e) => onChange({ originPath: e.target.value })}
          className="w-full rounded-lg border px-3 py-2"
          placeholder="/"
        />
      </label>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableHttps}
            onChange={(e) => onChange({ enableHttps: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">启用 HTTPS</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableCompression}
            onChange={(e) => onChange({ enableCompression: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">启用压缩</span>
        </label>
      </div>

      <button
        onClick={onGenerate}
        disabled={!config.domain || !config.originDomain}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        生成配置
      </button>
    </div>
  );
}
