/**
 * 添加服务表单
 *
 * 单一职责：组合绑定/构建分区并提交（分区实现见 service-binding/build-fields）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Button } from '@/components/ui';
import type {
  ServiceForm,
  ApplicationItem,
  ProjectEnvironment,
  Server,
  Site,
  ManagedResource,
} from '../types';
import { ServiceBindingFields } from './service-binding-fields';
import { ServiceBuildFields } from './service-build-fields';

interface CreateServiceFormProps {
  form: ServiceForm;
  onChange: (patch: Partial<ServiceForm>) => void;
  applications: ApplicationItem[];
  environments: ProjectEnvironment[];
  servers: Server[];
  sites: Site[];
  resources: ManagedResource[];
  saving: boolean;
  onCreate: () => void;
}

export function CreateServiceForm(props: CreateServiceFormProps) {
  const { form, onChange, saving, onCreate } = props;
  const t = useTranslations('applications');
  const handleCreate = usePersistFn(() => onCreate());

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">{t('addService')}</h2>
      <div className="mt-4 space-y-4">
        <ServiceBindingFields
          form={form}
          onChange={onChange}
          applications={props.applications}
          environments={props.environments}
          servers={props.servers}
          sites={props.sites}
          resources={props.resources}
        />
        <ServiceBuildFields
          form={form}
          onChange={onChange}
        />
        <Button
          onClick={handleCreate}
          disabled={saving}
          block
        >
          {t('addService')}
        </Button>
      </div>
    </section>
  );
}
