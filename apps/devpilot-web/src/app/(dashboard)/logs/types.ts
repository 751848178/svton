/** 日志域类型 - 基础实体（项目/应用/服务器/站点/资源/备份/告警/部署）。 */

export interface Project {
  id: string;
  name: string;
}

export interface ApplicationServiceItem {
  id: string;
  name: string;
  kind: string;
  status: string;
}

export interface ApplicationItem {
  id: string;
  name: string;
  project?: Project | null;
  services: ApplicationServiceItem[];
}

export interface Server {
  id: string;
  name: string;
  host: string;
  status: string;
}

export interface Site {
  id: string;
  name: string;
  primaryDomain: string;
  status: string;
}

export interface ManagedResource {
  id: string;
  name: string;
  provider: string;
  kind: string;
  status: string;
}

export interface BackupPlan {
  id: string;
  name: string;
  backupType: string;
  status: string;
  lastStatus?: string | null;
}

export interface AlertEvent {
  id: string;
  metric: string;
  severity: string;
  status: string;
  summary?: string | null;
}

export interface DeploymentRun {
  id: string;
  source: string;
  trigger: string;
  status: string;
  branch?: string | null;
}

export interface LogStats {
  windowMinutes: number;
  total: number;
  byLevel: Array<{ level: string; count: number }>;
  warningCount: number;
  errorCount: number;
  fatalCount: number;
}

export type TargetType =
  | 'service'
  | 'server'
  | 'site'
  | 'resource'
  | 'backup'
  | 'deployment'
  | 'alert'
  | 'manual';
