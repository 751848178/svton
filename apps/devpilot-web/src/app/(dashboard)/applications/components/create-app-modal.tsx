/**
 * 新建应用弹窗
 *
 * 单一职责：react-hook-form 收集应用基本信息并提交（参考 add-server-modal 模式）。
 * 取代旧的常驻 CreateAppForm；表单状态自包含，无外部共享状态。
 */

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal, ErrorBanner, Select } from '@/components/ui';
import type { Project } from '../types';
import type { AppInput } from '../hooks/use-application-creation.hooks';

interface CreateAppModalProps {
  open: boolean;
  onClose: () => void;
  /** 创建回调：返回值无关（仅 await 成功/抛错）。 */
  onCreate: (input: AppInput) => Promise<unknown>;
  projects: Project[];
  /** 打开时默认选中的项目（来自 ?projectId= 或首个项目）。 */
  defaultProjectId?: string;
}

interface CreateAppForm {
  projectId: string;
  name: string;
  repositoryUrl: string;
  defaultBranch: string;
  repoPath: string;
}

const DEFAULTS: CreateAppForm = {
  projectId: '',
  name: '',
  repositoryUrl: '',
  defaultBranch: 'main',
  repoPath: '',
};

export function CreateAppModal({
  open,
  onClose,
  onCreate,
  projects,
  defaultProjectId,
}: CreateAppModalProps) {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const { register, handleSubmit, reset, setError, formState } =
    useForm<CreateAppForm>({ defaultValues: DEFAULTS });

  // 弹窗打开时重置表单并预填默认项目。
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULTS, projectId: defaultProjectId || '' });
    }
  }, [open, defaultProjectId, reset]);

  const saving = formState.isSubmitting;
  const error = (formState.errors.root as { message?: string } | undefined)?.message || '';

  const onSubmit = async (data: CreateAppForm) => {
    try {
      await onCreate(data);
      onClose();
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('createAppFailed'),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('newApp')}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('selectProject')}</span>
          <Select
            {...register('projectId', { required: true })}
            placeholder={t('selectProject')}
          >
            {projects.map((p) => (
              <option
                key={p.id}
                value={p.id}
              >
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('appNamePlaceholder')}</span>
          <input
            {...register('name', { required: true })}
            className="w-full rounded-md border px-3 py-2"
            placeholder={t('appNamePlaceholder')}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('repoUrlPlaceholder')}</span>
          <input
            {...register('repositoryUrl')}
            className="w-full rounded-md border px-3 py-2"
            placeholder={t('repoUrlPlaceholder')}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('defaultBranchPlaceholder')}</span>
            <input
              {...register('defaultBranch')}
              className="w-full rounded-md border px-3 py-2"
              placeholder={t('defaultBranchPlaceholder')}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('repoPathPlaceholder')}</span>
            <input
              {...register('repoPath')}
              className="w-full rounded-md border px-3 py-2"
              placeholder={t('repoPathPlaceholder')}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? tc('processing') : tc('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
