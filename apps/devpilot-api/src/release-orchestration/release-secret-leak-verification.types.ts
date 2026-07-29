export type SecretLeakRecordType =
  | 'deployment_run'
  | 'server_execution_job'
  | 'deployment_log_stream'
  | 'deployment_log_entry'
  | 'execution_audit_event';

export interface SecretLeakScannableRecord {
  recordType: SecretLeakRecordType;
  recordId: string;
  fields: Record<string, unknown>;
}

export interface SecretLeakFinding {
  recordType: SecretLeakRecordType;
  recordId: string;
  field: string;
  path: string;
  detector: string;
}

export interface ReleaseSecretLeakScope {
  planId: string;
  projectId: string;
  environmentId: string;
  records: SecretLeakScannableRecord[];
}

export interface ReleaseSecretLeakVerificationResult {
  planId: string;
  verdict: 'clean' | 'leak_detected';
  coverageComplete: true;
  candidateCount: number;
  scannedRecordCount: number;
  scannedFieldCount: number;
  findingCount: number;
  findings: SecretLeakFinding[];
  auditEventId: string;
}
