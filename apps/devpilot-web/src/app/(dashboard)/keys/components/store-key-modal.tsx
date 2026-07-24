/**
 * 存储密钥弹窗
 *
 * 单一职责：收集密钥信息并提交存储。
 * react-hook-form 样板：取代手写 useSetState + 受控 onChange。
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import { KEY_TYPES } from '../constants';
import type { KeyInput, KeyScopeFilter } from '../types';

interface StoreKeyModalProps {
  open: boolean;
  initial?: Partial<KeyInput>;
  /** 作用域（来自 URL）。存在时展示绑定提示，作用域由父级在提交时注入。 */
  scope?: KeyScopeFilter;
  /** 可读的作用域标签(项目名/环境名),回退到 ID。 */
  scopeLabel?: { projectName?: string; environmentName?: string };
  onClose: () => void;
  onStore: (input: KeyInput) => Promise<void>;
}

const EMPTY_FORM: KeyInput = {
  name: '',
  type: 'jwt_secret',
  value: '',
  description: '',
};

export function StoreKeyModal({ open, initial, scope, scopeLabel, onClose, onStore }: StoreKeyModalProps) {
  const t = useTranslations('keys');
  const tc = useTranslations('common');
  const hasScope = Boolean(scope?.projectId || scope?.environmentId);
  const { register, handleSubmit, reset, formState } = useForm<KeyInput>({
    defaultValues: EMPTY_FORM,
  });

  // react-hook-form 的 defaultValues 仅在 mount 时生效;
  // 生成密钥后通过「保存到密钥中心」注入的 value/type 不会同步到表单字段。
  // 这里在弹窗打开(initial 变化)时主动 reset,把 value/type 预填进去 —— 修复 issue #13 反直觉问题。
  useEffect(() => {
    if (!open) return;
    reset({
      name: '',
      type: initial?.type || 'jwt_secret',
      value: initial?.value || '',
      description: '',
    });
  }, [open, initial, reset]);

  const onSubmit = async (data: KeyInput) => {
    await onStore(data);
    onClose();
    reset(EMPTY_FORM);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('storeTitle')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {hasScope ? (
          <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            {t('storeScopedHint', {
              project: scopeLabel?.projectName || scope?.projectId || '',
              environment: scopeLabel?.environmentName || scope?.environmentId || '',
            })}
          </p>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeNameLabel')}</span>
          <input
            type="text"
            {...register('name')}
            className="w-full rounded-lg border px-3 py-2"
            placeholder={t('storeNamePlaceholder')}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeTypeLabel')}</span>
          <select
            {...register('type')}
            className="w-full rounded-lg border px-3 py-2"
          >
            {KEY_TYPES.map((kt) => (
              <option
                key={kt.value}
                value={kt.value}
              >
                {t(kt.labelKey)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeValueLabel')}</span>
          <textarea
            {...register('value')}
            className="w-full rounded-lg border px-3 py-2 font-mono text-sm"
            rows={3}
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('storeDescriptionLabel')}</span>
          <input
            type="text"
            {...register('description')}
            className="w-full rounded-lg border px-3 py-2"
            placeholder={t('storeDescriptionPlaceholder')}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-muted-foreground hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
