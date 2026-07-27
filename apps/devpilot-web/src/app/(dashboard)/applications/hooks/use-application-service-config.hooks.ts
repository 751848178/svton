import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { feedback } from '@/components/ui/feedback/feedback';
import { apiRequest } from '@/lib/api-client';
import type { ApplicationItem, ApplicationServiceItem, ServiceDeploymentForm } from '../types';
import { mergeServiceDeploymentConfig } from '../utils/deployment-lifecycle-config.utils';

export function useApplicationServiceConfig(reload: () => Promise<unknown>) {
  const tc = useTranslations('common');
  const updateServiceDeployment = usePersistFn(
    async (
      application: ApplicationItem,
      service: ApplicationServiceItem,
      form: ServiceDeploymentForm,
    ) => {
      await apiRequest(`PATCH:/applications/${application.id}/services/${service.id}`, {
        deployConfig: mergeServiceDeploymentConfig(service.deployConfig, form),
      });
      feedback.success(tc('updateSuccess'));
      await reload();
    },
  );

  return { updateServiceDeployment };
}
