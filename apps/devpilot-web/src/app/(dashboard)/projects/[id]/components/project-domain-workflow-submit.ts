import { splitCsv } from '@/app/(dashboard)/sites/utils';
import type { Site } from '@/app/(dashboard)/sites/types';
import type { ConfigRevisionDraft } from '../hooks/use-environment-config-governance';
import type { EnvironmentConfigRevision } from '../types/environment-config-revision.types';
import {
  buildDomainRevisionDraft,
  type ProjectDomainTarget,
  type ProjectDomainWorkflowForm,
} from './project-domain-workflow.model';

export type DomainWorkflowCompletion = {
  site: boolean;
  binding: boolean;
  revision: boolean;
};

type Request = <T>(route: string, body?: unknown) => Promise<T>;

export async function persistProjectDomainWorkflow(params: {
  projectId: string;
  environmentId: string;
  form: ProjectDomainWorkflowForm;
  target: ProjectDomainTarget;
  currentRevision: EnvironmentConfigRevision | null;
  originalSite?: Site | null;
  createdSite?: Site | null;
  completion: DomainWorkflowCompletion;
  request: Request;
  saveRevision: (draft: ConfigRevisionDraft) => Promise<unknown>;
  onProgress: (completion: DomainWorkflowCompletion, site: Site) => void;
}) {
  let completion = params.completion;
  let site = params.createdSite ?? params.originalSite ?? null;
  const payload = {
    name: params.form.name.trim(),
    primaryDomain: params.form.primaryDomain.trim().toLowerCase(),
    aliases: splitCsv(params.form.aliases),
    runtimeType: params.originalSite?.runtimeType ?? 'reverse_proxy',
    serverId: params.target.serverId ?? undefined,
    projectId: params.projectId,
    environmentId: params.environmentId,
  };

  if (!site) site = await params.request<Site>('POST:/sites', payload);
  else site = await params.request<Site>(`PUT:/sites/${site.id}`, payload);
  completion = { ...completion, site: true };
  params.onProgress(completion, site);

  if (!completion.binding && params.target.siteId !== site.id) {
    await params.request(
      `PUT:/applications/${params.target.applicationId}/services/${params.target.serviceId}`,
      { siteId: site.id },
    );
  }
  completion = { ...completion, binding: true };
  params.onProgress(completion, site);

  await params.saveRevision(buildDomainRevisionDraft({
    current: params.currentRevision,
    form: params.form,
    target: params.target,
    originalDomain: params.originalSite?.primaryDomain,
  }));
  completion = { site: true, binding: true, revision: true };
  params.onProgress(completion, site);
  return { completion, site };
}
