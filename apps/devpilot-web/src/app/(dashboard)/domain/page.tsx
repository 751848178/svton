'use client';

import { usePersistFn } from '@svton/hooks';
import { PageHeader } from '@/components/ui';
import { useDomainConfig } from './hooks/use-domain-config';
import { downloadTextFile } from './utils';
import type { SSLMode } from './types';

export default function DomainConfigPage() {
  const {
    config,
    setConfig,
    generatedConfig,
    certbotScript,
    email,
    setEmail,
    validation,
    validateDomain,
    generateNginxConfig,
    generateCertbotScript,
  } = useDomainConfig();

  const downloadConfig = usePersistFn(() => {
    downloadTextFile(generatedConfig, `${config.domain}.conf`);
  });
  const downloadCertbot = usePersistFn(() => {
    downloadTextFile(certbotScript, `certbot-${config.domain}.sh`);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="域名配置"
        description="生成 Nginx 反向代理配置和 SSL 证书脚本"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConfigForm
          config={config}
          onChange={setConfig}
          email={email}
          onEmailChange={setEmail}
          validation={validation}
          onValidate={validateDomain}
          onGenerateNginx={generateNginxConfig}
          onGenerateCertbot={generateCertbotScript}
        />

        <div className="space-y-4">
          {generatedConfig ? (
            <CodeBlock
              title="Nginx 配置"
              content={generatedConfig}
              onDownload={downloadConfig}
            />
          ) : null}
          {certbotScript ? (
            <CodeBlock
              title="Certbot 脚本"
              content={certbotScript}
              onDownload={downloadCertbot}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ConfigFormProps {
  config: ReturnType<typeof useDomainConfig>['config'];
  onChange: (patch: Partial<ReturnType<typeof useDomainConfig>['config']>) => void;
  email: string;
  onEmailChange: (v: string) => void;
  validation: { isValid: boolean } | null;
  onValidate: () => void;
  onGenerateNginx: () => void;
  onGenerateCertbot: () => void;
}

function ConfigForm(props: ConfigFormProps) {
  const {
    config,
    onChange,
    email,
    onEmailChange,
    validation,
    onValidate,
    onGenerateNginx,
    onGenerateCertbot,
  } = props;
  return (
    <div className="space-y-4 rounded-lg border bg-white p-6">
      <h2 className="font-semibold text-gray-900">配置选项</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">域名</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.domain}
            onChange={(e) => onChange({ domain: e.target.value })}
            onBlur={onValidate}
            className="flex-1 rounded-lg border px-3 py-2"
            placeholder="example.com"
          />
          {validation ? (
            <span
              className={`rounded-lg px-3 py-2 text-sm ${validation.isValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {validation.isValid ? '✓ 有效' : '✗ 无效'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">上游服务地址</label>
          <input
            type="text"
            value={config.upstream}
            onChange={(e) => onChange({ upstream: e.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="http://localhost"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">端口</label>
          <input
            type="number"
            value={config.upstreamPort}
            onChange={(e) => onChange({ upstreamPort: parseInt(e.target.value, 10) })}
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">SSL 模式</label>
        <select
          value={config.sslMode}
          onChange={(e) => onChange({ sslMode: e.target.value as SSLMode })}
          className="w-full rounded-lg border px-3 py-2"
        >
          <option value="none">无 SSL</option>
          <option value="letsencrypt">Let&apos;s Encrypt (免费)</option>
          <option value="custom">自定义证书</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">请求体大小限制 (MB)</label>
        <input
          type="number"
          value={config.clientMaxBodySize}
          onChange={(e) => onChange({ clientMaxBodySize: parseInt(e.target.value, 10) })}
          className="w-full rounded-lg border px-3 py-2"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableGzip}
            onChange={(e) => onChange({ enableGzip: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">启用 Gzip 压缩</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.enableWebSocket}
            onChange={(e) => onChange({ enableWebSocket: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-700">启用 WebSocket 支持</span>
        </label>
      </div>

      <button
        onClick={onGenerateNginx}
        disabled={!config.domain}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        生成 Nginx 配置
      </button>

      {config.sslMode === 'letsencrypt' ? (
        <div className="space-y-2 border-t pt-4">
          <label className="block text-sm font-medium text-gray-700">Let&apos;s Encrypt 邮箱</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full rounded-lg border px-3 py-2"
            placeholder="admin@example.com"
          />
          <button
            onClick={onGenerateCertbot}
            disabled={!config.domain || !email}
            className="w-full rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
          >
            生成证书申请脚本
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CodeBlock({
  title,
  content,
  onDownload,
}: {
  title: string;
  content: string;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <button
          onClick={onDownload}
          className="rounded px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
        >
          下载
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
        {content}
      </pre>
    </div>
  );
}
