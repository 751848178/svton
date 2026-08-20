'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseBuildItem } from '../types/release-order.types';

interface Props {
  manifestId: string;
  manifests: ReleaseBuildItem[];
  selectedBuild: ReleaseBuildItem | null;
  buildsLoading: boolean;
  deploying: boolean;
  gateAllowed: boolean;
  gateReason?: string;
  decisionShown?: boolean;
  onManifestChange: (manifestId: string) => void;
  onDeploy: (manifestId: string) => void;
}

export function ReleaseStagingDeployControl(props: Props) {
  const t = useTranslations('projects');
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <h3 className="font-semibold">{t('releaseStepStagingTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('releaseStepStagingDescription')}
          </p>
        </div>
        {props.gateAllowed || !props.decisionShown ? (
          <Button
            onClick={() => props.onDeploy(props.manifestId)}
            loading={props.deploying}
            disabled={!props.manifestId || !props.gateAllowed}
            title={props.gateReason}
          >
            {t('deployManifestToStaging')}
          </Button>
        ) : null}
      </div>
      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium">{t('releaseStagingManifestLabel')}</span>
        <select
          className="w-full rounded-md border bg-background px-3 py-2"
          value={props.manifestId}
          onChange={(event) => props.onManifestChange(event.target.value)}
          disabled={props.buildsLoading || props.deploying}
          title={
            props.selectedBuild?.manifest
              ? t('releaseStagingManifestOption', {
                  buildId: props.selectedBuild.id,
                  revision: props.selectedBuild.revision,
                  manifestId: props.selectedBuild.manifest.id,
                  digest: props.selectedBuild.manifest.digest.slice(0, 19),
                })
              : undefined
          }
        >
          {props.manifests.length === 0 ? (
            <option value="">{t('releaseStagingNoManifest')}</option>
          ) : null}
          {props.manifests.map((build) => (
            <option key={build.manifest!.id} value={build.manifest!.id}>
              {t('releaseStagingManifestOption', {
                buildId: shortId(build.id),
                revision: build.revision,
                manifestId: shortId(build.manifest!.id),
                digest: build.manifest!.digest.slice(0, 19),
              })}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function shortId(value: string) {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}
