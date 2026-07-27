'use client';

import type { useApplications } from '../hooks/use-applications';
import type { useApplicationsPageState } from '../hooks/use-applications-page-state.hooks';
import type { useDeployWizardHost } from './deploy-wizard/deploy-wizard-host';
import { AddServiceModal } from './add-service-modal';
import { CreateAppModal } from './create-app-modal';
import { DeployWizardHost } from './deploy-wizard/deploy-wizard-host';
import { EditServiceDeploymentModal } from './edit-service-deployment-modal.component';

interface Props {
  data: ReturnType<typeof useApplications>;
  pageState: ReturnType<typeof useApplicationsPageState>;
  deployHost: ReturnType<typeof useDeployWizardHost>;
}

export function ApplicationsDialogs({ data, pageState, deployHost }: Props) {
  return (
    <>
      <CreateAppModal
        open={pageState.appModalOpen}
        onClose={pageState.closeAppModal}
        onCreate={data.createApplication}
        projects={data.projects}
        defaultProjectId={data.defaultProjectId}
      />
      <AddServiceModal
        open={pageState.serviceModalOpen}
        onClose={pageState.handleCloseServiceModal}
        application={pageState.serviceApplication}
        environments={pageState.serviceEnvironments}
        servers={data.servers}
        sites={pageState.serviceSites}
        resources={pageState.serviceResources}
        onCreate={data.createService}
      />
      <EditServiceDeploymentModal
        open={Boolean(pageState.editingDeployment)}
        application={pageState.editingDeployment?.application || null}
        service={pageState.editingDeployment?.service || null}
        onClose={pageState.handleCloseDeploymentConfig}
        onSave={data.updateServiceDeployment}
      />
      <DeployWizardHost host={deployHost} />
    </>
  );
}
