/**
 * 连接 Git 账号弹窗
 *
 * 单一职责：收集 Git 提供商与 Access Token 并提交连接。
 * 使用 @svton/ui Modal（含焦点陷阱、过渡、遮罩关闭）。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { Modal, ErrorBanner } from '@/components/ui';
import type { GitConnectInput, GitProvider } from '../types';
import { PROVIDER_OPTIONS, tokenPermissionHints } from '../constants';

interface ConnectGitModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: (input: GitConnectInput) => Promise<void>;
}

export function ConnectGitModal({ open, onClose, onConnect }: ConnectGitModalProps) {
  const [provider, setProvider] = useState<GitProvider>('github');
  const [accessToken, setAccessToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = usePersistFn(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onConnect({ provider, accessToken });
      onClose();
      setAccessToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '连接失败');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="连接 Git 账号"
      width={480}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Git 提供商</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as GitProvider)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Access Token</span>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder="输入你的 Personal Access Token"
          />
          <p className="mt-1 text-xs text-muted-foreground">{tokenPermissionHints[provider]}</p>
        </label>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !accessToken}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? '连接中...' : '连接'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
