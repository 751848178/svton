'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type SSLMode = 'none' | 'letsencrypt' | 'custom';

interface DomainConfig {
  domain: string;
  upstream: string;
  upstreamPort: number;
  sslMode: SSLMode;
  enableGzip: boolean;
  enableWebSocket: boolean;
  clientMaxBodySize: number;
}

export default function DomainConfigPage() {
  const [config, setConfig] = useState<DomainConfig>({
    domain: '',
    upstream: 'http://localhost',
    upstreamPort: 3000,
    sslMode: 'none',
    enableGzip: true,
    enableWebSocket: false,
    clientMaxBodySize: 10,
  });
  const [generatedConfig, setGeneratedConfig] = useState<string>('');
  const [certbotScript, setCertbotScript] = useState<string>('');
  const [email, setEmail] = useState('');
  const [validationResult, setValidationResult] = useState<{ isValid: boolean } | null>(null);

  const validateDomain = async () => {
    if (!config.domain) return;
    try {
      const result = await api.get<{ isValid: boolean }>(`/domain/validate?domain=${config.domain}`);
      setValidationResult(result);
    } catch {
      setValidationResult({ isValid: false });
    }
  };

  const generateNginxConfig = async () => {
    try {
      const result = await api.post<{ configContent: string }>('/domain/nginx-config', config);
      setGeneratedConfig(result.configContent);
    } catch (error) {
      console.error('Failed to generate config:', error);
    }
  };

  const generateCertbotScript = async () => {
    if (!email) {
      alert('请输入邮箱地址');
      return;
    }
    try {
      const result = await api.post<{ script: string }>('/domain/certbot-script', {
        domain: config.domain,
        email,
      });
      setCertbotScript(result.script);
    } catch (error) {
      console.error('Failed to generate script:', error);
    }
  };

  const downloadConfig = () => {
    const blob = new Blob([generatedConfig], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.domain}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">域名配置</h1>
        <p className="text-gray-600 mt-1">生成 Nginx 反向代理配置和 SSL 证书脚本</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 配置表单 */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">配置选项</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">域名</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.domain}
                onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                onBlur={validateDomain}
                className="flex-1 px-3 py-2 border rounded-lg"
                placeholder="example.com"
              />
              {validationResult && (
                <span className={`px-3 py-2 rounded-lg text-sm ${
                  validationResult.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {validationResult.isValid ? '✓ 有效' : '✗ 无效'}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">上游服务地址</label>
              <input
                type="text"
                value={config.upstream}
                onChange={(e) => setConfig({ ...config, upstream: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="http://localhost"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">端口</label>
              <input
                type="number"
                value={config.upstreamPort}
                onChange={(e) => setConfig({ ...config, upstreamPort: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SSL 模式</label>
            <select
              value={config.sslMode}
              onChange={(e) => setConfig({ ...config, sslMode: e.target.value as SSLMode })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="none">无 SSL</option>
              <option value="letsencrypt">Let&apos;s Encrypt (免费)</option>
              <option value="custom">自定义证书</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              请求体大小限制 (MB)
            </label>
            <input
              type="number"
              value={config.clientMaxBodySize}
              onChange={(e) => setConfig({ ...config, clientMaxBodySize: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enableGzip}
                onChange={(e) => setConfig({ ...config, enableGzip: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">启用 Gzip 压缩</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enableWebSocket}
                onChange={(e) => setConfig({ ...config, enableWebSocket: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-gray-700">启用 WebSocket 支持</span>
            </label>
          </div>

          <button
            onClick={generateNginxConfig}
            disabled={!config.domain}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            生成 Nginx 配置
          </button>

          {config.sslMode === 'letsencrypt' && (
            <div className="pt-4 border-t space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Let&apos;s Encrypt 邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="admin@example.com"
              />
              <button
                onClick={generateCertbotScript}
                disabled={!config.domain || !email}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                生成证书申请脚本
              </button>
            </div>
          )}
        </div>

        {/* 生成结果 */}
        <div className="space-y-4">
          {generatedConfig && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Nginx 配置</h2>
                <button
                  onClick={downloadConfig}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  下载
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {generatedConfig}
              </pre>
            </div>
          )}

          {certbotScript && (
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Certbot 脚本</h2>
                <button
                  onClick={() => {
                    const blob = new Blob([certbotScript], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `certbot-${config.domain}.sh`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  下载
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                {certbotScript}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
