'use client';

import { useEffect, useState } from 'react';
import { Button } from '@svton/ui';
import { useTranslations } from 'next-intl';
import { feedback } from '@/components/ui/feedback/feedback';
import { useEnvironmentConfigGovernance } from '../hooks/use-environment-config-governance';
import type { Project, ProjectEnvironment } from '../types';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';
import {
  EnvironmentConfigReferenceEditor,
  type RouteDraft,
} from './environment-config-reference-editor';
import { EnvironmentConfigResourceEditor } from './environment-config-resource-editor';

const EMPTY_ROUTE: RouteDraft = {
  domains: '', dnsProvider: '', tlsRequired: false, proxyTarget: '',
};

export function EnvironmentConfigGovernanceSection({
  environment,
  project,
  onSaved,
}: {
  environment: ProjectEnvironment;
  project: Project;
  onSaved: (updated: ProjectEnvironment) => void;
}) {
  const t = useTranslations('projects');
  const governance = useEnvironmentConfigGovernance(environment, project.id, onSaved);
  const [secretIds, setSecretIds] = useState<string[]>([]);
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [resources, setResources] = useState<EnvironmentConfigResourceReference[]>([]);
  const [route, setRoute] = useState<RouteDraft>(EMPTY_ROUTE);
  const [summary, setSummary] = useState('');
  const current = governance.current;

  useEffect(() => {
    if (!current) return;
    setSecretIds(current.secretReferences.map((item) => item.id));
    setPolicyIds(current.policyReferences.map((item) => item.id));
    setResources(current.resourceReferences);
    setRoute({
      domains: (current.routeSnapshot?.domains ?? []).join('\n'),
      dnsProvider: current.routeSnapshot?.dnsProvider ?? '',
      tlsRequired: current.routeSnapshot?.tlsRequired ?? false,
      proxyTarget: current.routeSnapshot?.proxyTarget ?? '',
    });
  }, [current]);

  const secrets = (project.secretKeys ?? []).filter(
    (secret) => !secret.environment || secret.environment.id === environment.id,
  );

  const save = async () => {
    try {
      await governance.save({
        secretReferenceIds: secretIds,
        resourceReferences: resources,
        routeSnapshot: {
          domains: route.domains.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
          dnsProvider: route.dnsProvider.trim() || undefined,
          tlsRequired: route.tlsRequired,
          proxyTarget: route.proxyTarget.trim() || undefined,
        },
        policyReferenceIds: policyIds,
        changeSummary: summary.trim() || undefined,
      });
      setSummary('');
      feedback.success(t('configRevisionSaveSuccess'));
    } catch (cause) {
      feedback.error(t('configRevisionSaveFailed'), {
        description: cause instanceof Error ? cause.message : undefined,
      });
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('configGovernanceTitle')}
          </h4>
          <p className="text-[11px] text-muted-foreground">{t('configGovernanceHint')}</p>
        </div>
        <div className="shrink-0 text-right text-xs">
          <div>{governance.current ? `R${governance.current.revision}` : '—'}</div>
          <div className="text-muted-foreground">
            {environment.identityLockedAt ? t('environmentKeyLocked') : t('environmentKeyLocksAfterDeploy')}
          </div>
        </div>
      </div>

      {governance.loading ? <p className="text-xs text-muted-foreground">{t('loading')}</p> : null}
      {governance.error ? <p className="text-xs text-destructive">{governance.error}</p> : null}

      {!governance.loading ? (
        <>
          <EnvironmentConfigReferenceEditor
            secrets={secrets}
            secretIds={secretIds}
            onSecretIdsChange={setSecretIds}
            policies={governance.policies}
            policyIds={policyIds}
            onPolicyIdsChange={setPolicyIds}
            route={route}
            onRouteChange={setRoute}
          />
          <EnvironmentConfigResourceEditor
            project={project}
            environment={environment}
            value={resources}
            onChange={setResources}
          />
          <input
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={t('configChangeSummary')}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t('configRevisionHistoryCount', { count: governance.data?.revisions.length ?? 0 })}
            </span>
            <Button size="sm" onClick={save} disabled={governance.saving}>
              {governance.saving ? t('saving') : t('configCreateRevision')}
            </Button>
          </div>
          {governance.data?.revisions.slice(0, 3).map((revision) => (
            <div key={revision.id} className="flex justify-between text-[11px] text-muted-foreground">
              <span>R{revision.revision} · {revision.source}</span>
              <span className="font-mono">{revision.snapshotHash.slice(0, 10)}</span>
            </div>
          ))}
        </>
      ) : null}
    </section>
  );
}
