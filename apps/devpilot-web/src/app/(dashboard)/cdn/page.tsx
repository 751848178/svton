'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type CDNProvider = 'qiniu' | 'aliyun' | 'tencent' | 'cloudflare';

interface CDNConfig {
  provider: CDNProvider;
  domain: string;
  originDomain: string;
  originPath: string;
  enableHttps: boolean;
  enableCompression: boolean;
}

const providers = [
  { value: 'qiniu', label: '七牛云', icon: '🌐' },
  { value: 'aliyun', label: '阿里云 CDN', icon: '☁️' },
  { value: 'tencent', label: '腾讯云 CDN', icon: '🔷' },
  { value: 'cloudflare', label: 'Cloudflare', icon: '🛡️' },
];

export default function CDNConfigPage() {
  const [config, setConfig] = useState<CDNConfig>({
    provider: 'qiniu',
    domain: '',
    originDomain: '',
    originPath: '/',
    enableHttps: true,
    enableCompression: true,
  });
  const [results, setResults] = useState<{
    urlConfig?: Record<string, string>;
    frontendConfig?: string;
    refreshScript?: string;
    nextjsConfig?: string;
    envConfig?: string;
  }>({});
  const [activeTab, setActiveTab] = useState<'url' | 'frontend' | 'refresh' | 'nextjs' | 'env'>('url');

  const generateAll = async () => {
    try {
      const [urlConfig, frontendConfig, refreshScript, nextjsConfig, envConfig] = await Promise.all([
        api.post<Record<string, string>>('/cdn/url-config', config),
        api.post<{ content: string }>('/cdn/frontend-config', config),
        api.post<{ content: string }>('/cdn/refresh-script', config),
        api.post<{ content: string }>('/cdn/nextjs-config', config),
        api.post<{ content: string }>('/cdn/env-config', config),
      ]);

      setResults({
        urlConfig,
        frontendConfig: frontendConfig.content,
        refreshScript: refreshScript.content,
        nextjsConfig: nextjsConfig.content,
        envConfig: envConfig.content,
      });
    } catch (error) {
      console.error('Failed to generate CDN config:', error);
    }
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CDN 配置</h1>
        <p className="text-gray-600 mt-1">生成 CDN 相关配置和刷新脚本</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 配置表单 */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">CDN 配置</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CDN 提供商</label>
            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setConfig({ ...config, provider: p.value as CDNProvider })}
                  className={`p-3 border rounded-lg text-left ${
                    config.provider === p.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl mr-2">{p.icon}</span>
                  <span className="text-sm font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CDN 域名</label>
            <input
              type="text"
              value={config.domain}
              onChange={(e) => setConfig({ ...config, domain: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="cdn.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">源站域名</label>
            <input
              type="text"
              value={config.originDomain}
              onChange={(e) => setConfig({ ...config, originDomain: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="origin.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">源站路径</label>
            <input
              type="text"
              value={config.originPath}
              onChange={(e) => setConfig({ ...config, originPath: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="/"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enableHttps}
                onChange={(e) => setConfig({ ...config, enableHttps: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">启用 HTTPS</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enableCompression}
                onChange={(e) => setConfig({ ...config, enableCompression: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">启用压缩</span>
            </label>
          </div>

          <button
            onClick={generateAll}
            disabled={!config.domain || !config.originDomain}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            生成配置
          </button>
        </div>

        {/* 生成结果 */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {/* 标签页 */}
          <div className="flex border-b overflow-x-auto">
            {[
              { key: 'url', label: 'URL 配置' },
              { key: 'frontend', label: '前端配置' },
              { key: 'refresh', label: '刷新脚本' },
              { key: 'nextjs', label: 'Next.js' },
              { key: 'env', label: '环境变量' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'url' && results.urlConfig && (
              <div className="space-y-2">
                {Object.entries(results.urlConfig).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <code className="text-sm text-gray-600">{key}</code>
                    <code className="text-sm text-blue-600">{value}</code>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'frontend' && results.frontendConfig && (
              <div>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => downloadFile(results.frontendConfig!, 'cdn.config.ts')}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    下载
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {results.frontendConfig}
                </pre>
              </div>
            )}

            {activeTab === 'refresh' && results.refreshScript && (
              <div>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => downloadFile(results.refreshScript!, `cdn-refresh-${config.provider}.sh`)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    下载
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {results.refreshScript}
                </pre>
              </div>
            )}

            {activeTab === 'nextjs' && results.nextjsConfig && (
              <div>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => downloadFile(results.nextjsConfig!, 'next.config.cdn.js')}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    下载
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {results.nextjsConfig}
                </pre>
              </div>
            )}

            {activeTab === 'env' && results.envConfig && (
              <div>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => downloadFile(results.envConfig!, '.env.cdn')}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    下载
                  </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  {results.envConfig}
                </pre>
              </div>
            )}

            {!results.urlConfig && !results.frontendConfig && (
              <div className="text-center py-12 text-gray-500">
                填写配置后点击"生成配置"按钮
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
