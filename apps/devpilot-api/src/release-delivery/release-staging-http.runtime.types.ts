export interface ReleaseStagingHttpBuild {
  id: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  logSummary: unknown;
  manifest: { id: string; digest: string };
}

export interface ReleaseStagingHttpDeployment {
  id: string;
  status: string;
  artifactManifestId: string;
  adapterKey: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  error?: string | null;
  logs?: unknown;
}
