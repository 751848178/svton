export type ConfigMode = 'files' | 'inherit' | 'version';
export interface ConfigBinding { mode: ConfigMode; versionId?: string; version?: string; name?: string }
export interface VariablePatch { key: string; value?: string; secret?: boolean; delete?: boolean }
export interface ServicePatch { serviceKey: string; noEnv?: boolean; variables?: VariablePatch[] }
export interface VariableView { key: string; secret: boolean; hasValue: boolean; value?: string }
export interface ConfigService { serviceKey: string; noEnv: boolean; variables: VariableView[] }
interface ConfigRecord { id: string; projectId: string; targetKey: string; name: string; parentId: string | null; services: ConfigService[]; createdAt: string; updatedAt: string }
export interface ConfigDraft extends ConfigRecord { defaults: VariableView[]; etag: string; status: 'draft' | 'frozen' }
export interface ConfigVersion extends ConfigRecord { version: string; archivedAt: string | null }
export interface ConfigDraftInput { name: string; baseVersionId?: string; defaults?: VariablePatch[]; services?: ServicePatch[] }
export interface ConfigDraftPatch { etag: string; name?: string; defaults?: VariablePatch[]; services?: ServicePatch[] }
export interface ConfigDifference { added: string[]; removed: string[]; changed: string[]; noEnvChanged: boolean; status?: 'compared' | 'not-comparable' }
export interface ConfigPreview { etag?: string; services: Record<string, ConfigDifference> }
