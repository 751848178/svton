'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { ErrorBanner, Modal } from '@/components/ui';
import type { ApplicationItem, ApplicationServiceItem, ServiceDeploymentForm } from '../types';
import { readServiceDeploymentForm } from '../utils/deployment-lifecycle-config.utils';
import { ServiceBuildFields } from './service-build-fields';

interface Props {
  open: boolean;
  application: ApplicationItem | null;
  service: ApplicationServiceItem | null;
  onClose: () => void;
  onSave: (
    application: ApplicationItem,
    service: ApplicationServiceItem,
    form: ServiceDeploymentForm,
  ) => Promise<void>;
}

export function EditServiceDeploymentModal(props: Props) {
  const { open, application, service, onClose, onSave } = props;
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  const { handleSubmit, reset, watch, setValue, setError, formState } =
    useForm<ServiceDeploymentForm>({
      defaultValues: readServiceDeploymentForm(),
    });

  useEffect(() => {
    if (open) reset(readServiceDeploymentForm(service));
  }, [open, reset, service]);

  const form = watch();
  const onChange = (patch: Partial<ServiceDeploymentForm>) => {
    for (const key of Object.keys(patch) as Array<keyof ServiceDeploymentForm>) {
      setValue(key, patch[key] || '', { shouldDirty: true });
    }
  };
  const error = (formState.errors.root as { message?: string } | undefined)?.message || '';

  const submit = async (value: ServiceDeploymentForm) => {
    if (!application || !service || !value.deployCommand.trim()) {
      setError('root', { message: t('deployCommandRequired') });
      return;
    }
    try {
      await onSave(application, service, value);
      onClose();
    } catch (submitError) {
      setError('root', {
        message:
          submitError instanceof Error ? submitError.message : t('serviceConfigUpdateFailed'),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? t('editServiceDeployment', { service: service.name }) : ''}
    >
      <form
        onSubmit={handleSubmit(submit)}
        className="space-y-4"
      >
        {error ? (
          <ErrorBanner
            message={error}
            variant="inline"
          />
        ) : null}
        <ServiceBuildFields
          form={form}
          onChange={onChange}
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {formState.isSubmitting ? tc('processing') : tc('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
