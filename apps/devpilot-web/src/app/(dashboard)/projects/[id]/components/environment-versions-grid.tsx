'use client';

import { useState } from 'react';
import type {
  EnvironmentVersionActionResult,
  EnvironmentVersionCandidates,
  EnvironmentVersionEnvironment,
} from '../types/environment-version.types';
import { approvedEnvironmentVersionRun, EnvironmentVersionCard } from './environment-version-card';
import { EnvironmentUpgradeDialog } from './environment-upgrade-dialog';

interface UpgradeTarget {
  environment: EnvironmentVersionEnvironment;
  candidateId: string;
  releaseRunId?: string;
}

export function EnvironmentVersionsGrid(props: {
  projectId: string;
  environments: EnvironmentVersionEnvironment[];
  candidates: EnvironmentVersionCandidates;
  executing: boolean;
  onExecute: (
    environmentId: string,
    input: {
      kind: 'upgrade';
      manifestId: string;
      releaseRunId?: string;
    },
  ) => Promise<EnvironmentVersionActionResult | null>;
  onRecovery: (environment: EnvironmentVersionEnvironment, sourceVersionId: string) => void;
}) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [upgradeTarget, setUpgradeTarget] = useState<UpgradeTarget | null>(null);
  const targetCandidate = upgradeTarget
    ? props.candidates[upgradeTarget.environment.baselineRole].find(
        (candidate) => candidate.id === upgradeTarget.candidateId,
      )
    : undefined;
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        {props.environments.map((environment) => {
          const candidates = props.candidates[environment.baselineRole] ?? [];
          const selectedId = selection[environment.id] || candidates[0]?.id || '';
          const candidate = candidates.find((item) => item.id === selectedId);
          const releaseRunId = approvedEnvironmentVersionRun(candidate);
          return (
            <EnvironmentVersionCard
              key={environment.id}
              projectId={props.projectId}
              environment={environment}
              candidates={candidates}
              selectedId={selectedId}
              executing={props.executing}
              productionBlocked={environment.baselineRole === 'production' && !releaseRunId}
              onSelect={(id) => setSelection((current) => ({ ...current, [environment.id]: id }))}
              onUpgrade={() =>
                candidate &&
                setUpgradeTarget({ environment, candidateId: candidate.id, releaseRunId })
              }
              onRecovery={(sourceVersionId) => props.onRecovery(environment, sourceVersionId)}
            />
          );
        })}
      </div>
      {upgradeTarget && targetCandidate ? (
        <EnvironmentUpgradeDialog
          environment={upgradeTarget.environment}
          candidate={targetCandidate}
          onClose={() => setUpgradeTarget(null)}
          onConfirm={() =>
            props.onExecute(upgradeTarget.environment.id, {
              kind: 'upgrade',
              manifestId: targetCandidate.id,
              releaseRunId:
                upgradeTarget.environment.baselineRole === 'production'
                  ? upgradeTarget.releaseRunId
                  : undefined,
            })
          }
        />
      ) : null}
    </>
  );
}
