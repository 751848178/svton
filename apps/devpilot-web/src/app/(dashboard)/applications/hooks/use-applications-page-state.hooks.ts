'use client';

import { useEffect, useRef, useState } from 'react';
import { useBoolean, usePersistFn } from '@svton/hooks';
import type {
  ApplicationItem,
  ApplicationServiceItem,
  ManagedResource,
  ProjectEnvironment,
  Site,
} from '../types';

export function useApplicationsPageState(input: {
  shouldCreate: boolean;
  deploymentDeepLink: {
    projectId: string;
    environmentId: string;
    serviceId: string;
  } | null;
  applications: ApplicationItem[];
  environments: ProjectEnvironment[];
  sites: Site[];
  resources: ManagedResource[];
}) {
  const [appModalOpen, { setTrue: openAppModal, setFalse: closeAppModal }] = useBoolean(false);
  const [serviceAppId, setServiceAppId] = useState('');
  const [editingDeployment, setEditingDeployment] = useState<{
    application: ApplicationItem;
    service: ApplicationServiceItem;
  } | null>(null);
  const consumedDeepLink = useRef('');

  useEffect(() => {
    if (input.shouldCreate) openAppModal();
  }, [input.shouldCreate, openAppModal]);

  useEffect(() => {
    const link = input.deploymentDeepLink;
    if (!link?.projectId || !link.environmentId || !link.serviceId) return;
    const signature = `${link.projectId}:${link.environmentId}:${link.serviceId}`;
    if (consumedDeepLink.current === signature) return;
    const application = input.applications.find((item) =>
      item.projectId === link.projectId && item.services.some((service) =>
        service.id === link.serviceId && service.environment.id === link.environmentId));
    const service = application?.services.find((item) => item.id === link.serviceId);
    if (!application || !service) return;
    consumedDeepLink.current = signature;
    setEditingDeployment({ application, service });
  }, [input.applications, input.deploymentDeepLink]);

  const handleAddService = usePersistFn((app: ApplicationItem) => setServiceAppId(app.id));
  const handleCloseServiceModal = usePersistFn(() => setServiceAppId(''));
  const handleEditServiceDeployment = usePersistFn(
    (application: ApplicationItem, service: ApplicationServiceItem) =>
      setEditingDeployment({ application, service }),
  );
  const handleCloseDeploymentConfig = usePersistFn(() => setEditingDeployment(null));
  const serviceApplication = input.applications.find((app) => app.id === serviceAppId) || null;
  const projectId = serviceApplication?.projectId || '';

  return {
    appModalOpen,
    openAppModal,
    closeAppModal,
    serviceModalOpen: Boolean(serviceAppId),
    serviceApplication,
    handleAddService,
    handleCloseServiceModal,
    editingDeployment,
    handleEditServiceDeployment,
    handleCloseDeploymentConfig,
    serviceEnvironments: input.environments.filter((item) => item.project?.id === projectId),
    serviceSites: input.sites.filter((item) => !item.projectId || item.projectId === projectId),
    serviceResources: input.resources.filter(
      (item) => !item.project?.id || item.project.id === projectId,
    ),
  };
}
