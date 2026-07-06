/**
 * 连接 Git 账号弹窗
 *
 * 单一职责：收集 Git 提供商与 Access Token 并提交连接。
 * 使用 @svton/ui Modal（含焦点陷阱、过渡、遮罩关闭）。
 * react-hook-form 样板：取代手写 useState + 受控 onChange。
 */

import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal, ErrorBanner } from '@/components/ui';
import type { GitConnectInput } from '../types';
import { PROVIDER_OPTIONS, tokenPermissionHints } from '../constants';

interface ConnectGitModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: (input: GitConnectInput) => Promise<void>;
}

export function ConnectGitModal({ open, onClose, onConnect }: ConnectGitModalProps) {
  const t = useTranslations('git');
  const tc = useTranslations('common');
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState,
  } = useForm<GitConnectInput>({
    defaultValues: {
      provider: 'github',
      accessToken: '',
    },
  });

  const provider = watch('provider');
  const accessToken = watch('accessToken');

  const submit = handleSubmit(async (data) => {
    try {
      await onConnect(data);
      onClose();
      reset({ provider: data.provider, accessToken: '' });
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('connectFailed'),
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('connect')}
      width={480}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        {(formState.errors.root as { message?: string } | undefined)?.message ? (
          <ErrorBanner
            message={(formState.errors.root as { message?: string } | undefined)?.message || ''}
            variant="inline"
          />
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('provider')}</span>
          <select
            {...register('provider')}
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
          <span className="mb-1 block font-medium">{t('accessToken')}</span>
          <input
            type="password"
            {...register('accessToken', { required: true })}
            required
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder={t('tokenPlaceholder')}
          />
          <p className="mt-1 text-xs text-muted-foreground">{tokenPermissionHints[provider]}</p>
        </label>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 transition-colors hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={formState.isSubmitting || !accessToken}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {formState.isSubmitting ? t('connecting') : t('connect')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
