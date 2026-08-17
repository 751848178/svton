import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const reportRoot = '/tmp/codex-tool-runs/svton/long-goals/agent-codex-desktop-ui-parity/invest';
const reports = {
  codeReview: `${reportRoot}/uiinv-027-code-review-runtime-ingress.md`,
  timeline: `${reportRoot}/uiinv-029-file-outcome-runtime-contract.md`,
  skills: `${reportRoot}/uiinv-030-skills-evidence-determinism.md`,
  skillsResult: `${reportRoot}/../workers/uiinv-030-result.json`,
} as const;
const codeReviewContracts = [
  'ai/agent-client/src/service/chat-tool-result-blocks.utils.ts',
  'ai/agent-client/src/service/pi-message-display-boundary.utils.ts',
  'ai/agent-client/src/hooks/session-message-conversion.utils.ts',
  'ai/agent-client/test/chat.service.test.ts',
  'ai/agent-client/test/serialization.test.ts',
  'packages/agent-ui/test/shared-result-presenters-locale.test.tsx',
  'packages/agent-ui/test/new-components.test.tsx',
  'packages/agent-ui/test/c3-source-contract.test.tsx',
] as const;
const timelineContracts = [
  'packages/agent-ui/src/components/timeline/TimelineSection.tsx',
  'packages/agent-ui/src/components/timeline/legacy-render-policy.ts',
  'packages/agent-ui/test/timeline-section.test.tsx',
  'packages/agent-ui/test/file-outcome-item.test.tsx',
  'packages/agent-ui/test/file-outcome-locale.test.tsx',
  'packages/agent-ui/test/timeline-presenters-locale.test.tsx',
  'packages/agent-ui/test/c3-source-contract.test.tsx',
] as const;
const skillsContracts = [
  'apps/agent-web/src/lib/agent-setup.ts',
  'apps/agent-web/src/lib/e2e-timeline-skill.ts',
  'apps/agent-web/src/components/WebSkillsPanel.tsx',
  'apps/agent-web/e2e/shared-web-locale.skills.scenario.ts',
  'apps/agent-web/test/agent-setup.test.ts',
  'apps/agent-web/test/web-auxiliary-panels.test.tsx',
] as const;

export interface DecisionHashes {
  codeReview: string;
  timeline: string;
  skills: string;
  skillsResult: string;
}

type DecisionReportPaths = Record<keyof DecisionHashes, string>;

export function readDecisionHashes(paths: DecisionReportPaths = reports): DecisionHashes {
  return {
    codeReview: hashFile(paths.codeReview),
    timeline: hashFile(paths.timeline),
    skills: hashFile(paths.skills),
    skillsResult: hashFile(paths.skillsResult),
  };
}

export function validateDecisionHashes(
  captured: DecisionHashes,
  current: DecisionHashes,
): string[] {
  const problems: string[] = [];
  if (!captured.codeReview || captured.codeReview !== current.codeReview) {
    problems.push('code-review exclusion decision changed during run');
  }
  if (!captured.timeline || captured.timeline !== current.timeline) {
    problems.push('timeline reachability decision changed during run');
  }
  if (!captured.skills || captured.skills !== current.skills) {
    problems.push('skills evidence decision changed during run');
  }
  if (!captured.skillsResult || captured.skillsResult !== current.skillsResult) {
    problems.push('skills evidence result changed during run');
  }
  return problems;
}

export function decisionManifest(
  captured: DecisionHashes,
  current: DecisionHashes,
  repositoryRoot: string,
) {
  return {
    exclusions: [codeReviewExclusion(captured, current, repositoryRoot)],
    runtimeReachability: timelineReachability(captured, current, repositoryRoot),
    skillsEvidence: skillsEvidenceDecision(captured, current, repositoryRoot),
  };
}

function codeReviewExclusion(
  captured: DecisionHashes,
  current: DecisionHashes,
  repositoryRoot: string,
) {
  return {
    feature: 'code_review', status: 'excluded_unreachable_by_current_agent_client_contract',
    positiveRuntimeClaims: [],
    decisionReport: reportHash(reports.codeReview, captured.codeReview, current.codeReview),
    negativeAndPresenterContracts: contractHashes(codeReviewContracts, repositoryRoot),
    followUp: 'I08.3-FU-CODE-REVIEW-INGRESS',
  };
}

function timelineReachability(
  captured: DecisionHashes,
  current: DecisionHashes,
  repositoryRoot: string,
) {
  return {
    status: 'typed_timeline_owners_selected',
    positiveRuntimeOwners: ['FileOutcomeItemView', 'ToolExecutionItemView',
      'CommandExecutionItemView', 'OutcomeItemView', 'ApprovalDecisionItemView'],
    excludedPositiveRuntimeOwners: ['FileChangeView', 'TurnDiffView', 'FileTreeBlockView'],
    requiredAbsenceAssertions: ['typed file outcome suppresses legacy file and turn diff',
      'typed tool execution suppresses matching legacy tool and file tree',
      'terminal execution has no stale process disclosure',
      'diagnostic outcome has no legacy warning or error duplicate'],
    decisionReport: reportHash(reports.timeline, captured.timeline, current.timeline),
    suppressionAndPresenterContracts: contractHashes(timelineContracts, repositoryRoot),
  };
}

function skillsEvidenceDecision(
  captured: DecisionHashes,
  current: DecisionHashes,
  repositoryRoot: string,
) {
  return {
    status: 'real_populated_inventory_selected',
    expectedInventory: ['svton', 'svton-api-client', 'svton-service',
      'engineering-craft-principles', 'universal-craft-principles',
      'verify-before-done', 'plan-before-code', 'codegraph-cli-navigation',
      'e2e-timeline-context', 'code-review'],
    emptyStateProof: 'component_only_with_explicit_empty_array',
    decisionReport: reportHash(reports.skills, captured.skills, current.skills),
    decisionResult: reportHash(
      reports.skillsResult, captured.skillsResult, current.skillsResult,
    ),
    registryAndEvidenceContracts: contractHashes(skillsContracts, repositoryRoot),
  };
}

function contractHashes(files: readonly string[], repositoryRoot: string) {
  return files.map((file) => ({ file, sha256: hashFile(resolve(repositoryRoot, file)) }));
}

function reportHash(path: string, captured: string, current: string) {
  return { path, capturedSha256: captured, currentSha256: current, currentMatch: captured === current };
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
