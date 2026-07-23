/**
 * 添加服务弹窗（应用已预绑定）
 *
 * 单一职责：react-hook-form 收集服务字段并提交，复用 ServiceBindingFields /
 * ServiceBuildFields（保持不变）。应用由 prop 固定，不再提供应用下拉选择。
 *
 * 适配说明：两个分区组件接收受控的 `form` + `onChange(patch)`，本弹窗用
 * react-hook-form 持有完整 ServiceForm，通过 watch/setValue 桥接到分区组件。
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Modal, ErrorBanner } from '@/components/ui';
import type {
  ServiceForm,
  ApplicationItem,
  ProjectEnvironment,
  Server,
  Site,
  ManagedResource,
} from '../types';
import type { ServiceInput } from '../hooks/use-application-creation.hooks';
import { ServiceBindingFields } from './service-binding-fields';
import { ServiceBuildFields } from './service-build-fields';

interface AddServiceModalProps {
  open: boolean;
  onClose: () => void;
  /** 已预绑定的应用（弹窗标题展示，服务创建后归属该应用）。 */
  application: ApplicationItem | null;
  /** 绑定/构建字段的可选选项（按应用所属项目过滤）。 */
  environments: ProjectEnvironment[];
  servers: Server[];
  sites: Site[];
  resources: ManagedResource[];
  onCreate: (applicationId: string, input: ServiceInput) => Promise<unknown>;
}

const DEFAULTS: ServiceForm = {
  applicationId: '',
  environmentId: '',
  name: '',
  kind: 'docker-compose',
  runtime: '',
  serverId: '',
  siteId: '',
  managedResourceId: '',
  workingDirectory: '',
  buildCommand: '',
  deployCommand: '',
  healthCheckUrl: '',
};

export function AddServiceModal({
  open,
  onClose,
  application,
  environments,
  servers,
  sites,
  resources,
  onCreate,
}: AddServiceModalProps) {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const { handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<ServiceForm>({ defaultValues: DEFAULTS });

  // 弹窗打开时重置表单并预填 applicationId（绑定分区虽展示但仅含该应用）。
  useEffect(() => {
    if (open) {
      reset({ ...DEFAULTS, applicationId: application?.id || '' });
    }
  }, [open, application?.id, reset]);

  // 受控 ServiceForm 快照 + onChange 桥接到分区组件。
  const form = watch();
  const onChange = (patch: Partial<ServiceForm>) => {
    (Object.keys(patch) as (keyof ServiceForm)[]).forEach((key) => {
      setValue(key, patch[key] as never, { shouldDirty: true });
    });
  };
  // 仅包含已预绑定应用，避免在弹窗中暴露全局应用切换。
  const boundApplications = useMemo(
    () => (application ? [application] : []),
    [application],
  );

  const saving = formState.isSubmitting;
  const error = (formState.errors.root as { message?: string } | undefined)?.message || '';

  const onSubmit = async (data: ServiceForm) => {
    if (!application || !data.environmentId || !data.name.trim()) {
      setError('root', { message: t('createServiceValidation') });
      return;
    }
    try {
      await onCreate(application.id, data);
      onClose();
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : t('createServiceFailed'),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={application ? t('addServiceToApp', { app: application.name }) : t('addService')}
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
        <ServiceBindingFields
          form={form}
          onChange={onChange}
          applications={boundApplications}
          environments={environments}
          servers={servers}
          sites={sites}
          resources={resources}
        />
        <ServiceBuildFields
          form={form}
          onChange={onChange}
        />
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
            {saving ? tc('processing') : tc('add')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
