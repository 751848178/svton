export interface Variable { value: string; secret: boolean }
export interface ServiceValues { noEnv: boolean; variables: Record<string, Variable> }
export interface DraftValues { defaults: Record<string, Variable>; services: Record<string, ServiceValues> }
export interface VariablePatch { key: string; value?: string; secret?: boolean; delete?: boolean }
export interface ServicePatch { serviceKey: string; noEnv?: boolean; variables?: VariablePatch[] }
export interface CreateDraft { name: string; baseVersionId?: string; defaults?: VariablePatch[]; services?: ServicePatch[] }
export interface PatchDraft { etag: number; name?: string; defaults?: VariablePatch[]; services?: ServicePatch[] }
export interface VariableView { key: string; secret: boolean; hasValue: boolean; value?: string }
export interface ServiceView { serviceKey: string; noEnv: boolean; variables: VariableView[] }
export interface ConfigRef { versionId: string; version: string; name: string; serviceKey: string }
export type CurrentConfigRefs = Record<string, { versionId?: string } | null | undefined>;
export interface ResolvedConfig {
  version: PublicVersion;
  configRefs: Record<string, ConfigRef>;
  envFiles: Record<string, string>;
  noEnvServices: string[];
  redactionValues: string[];
  fingerprint: string;
}
export interface PublicVersion {
  id: string; projectId: string; targetKey: string; name: string; version: string; parentId: string | null;
  archivedAt: string | null; services: ServiceView[]; createdAt: string;
}
