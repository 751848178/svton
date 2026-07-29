import type { RepositoryEvidence } from './repository-analysis.types';

export interface DetectedCommandSet {
  build?: string;
  start?: string;
  test?: string;
  migrate?: string;
  bootstrap?: string;
  seed?: string;
  backfill?: string;
}

export interface DetectedEnvironmentVariable {
  name: string;
  required: boolean;
  secret: boolean;
  evidence: RepositoryEvidence[];
}

export interface DetectedHealthCheck {
  path: string;
  kind: 'liveness' | 'readiness' | 'unknown';
  evidence: RepositoryEvidence[];
}

export interface DetectedContainer {
  dockerfile?: string;
  buildContext?: string;
  composeFiles: string[];
  composeServices: string[];
  dependsOn: string[];
}

export interface DetectedService {
  key: string;
  name: string;
  path: string;
  role: string;
  deployable: boolean;
  artifactOnly: boolean;
  framework: string[];
  runtime?: string;
  versions: Record<string, string>;
  commands: DetectedCommandSet;
  ports: number[];
  healthChecks: DetectedHealthCheck[];
  environment: DetectedEnvironmentVariable[];
  databases: string[];
  dependencies: string[];
  container: DetectedContainer;
  artifacts: string[];
  evidence: RepositoryEvidence[];
  warnings: string[];
}

export interface RepositoryInventory {
  files: string[];
  totalFiles: number;
  totalBytes: number;
  manifests: Record<string, string>;
}

export interface RepositoryAnalysisResult {
  repository: {
    monorepo: boolean;
    packageManager?: string;
    packageManagerVersion?: string;
    lockfiles: string[];
    workspacePatterns: string[];
  };
  services: DetectedService[];
  composeCandidates: Array<{
    file: string;
    services: string[];
    evidence: RepositoryEvidence[];
  }>;
  resourceRequirements: string[];
  warnings: string[];
  evidence: RepositoryEvidence[];
}

export interface RepositorySuggestionDraft {
  key: string;
  kind: 'project_repository' | 'environment' | 'application_service' | 'resource_requirement';
  confidence: 'high' | 'medium' | 'low';
  conflict: boolean;
  impact: string;
  currentValue?: unknown;
  proposedValue: unknown;
  evidence: RepositoryEvidence[];
  warnings: string[];
}
