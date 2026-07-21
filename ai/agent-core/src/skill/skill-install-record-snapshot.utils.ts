import type { SkillInstallRecord } from './types';
import { snapshotSkillSource } from './skill-source-snapshot.utils';

export function snapshotSkillInstallRecord(
  record: SkillInstallRecord,
): SkillInstallRecord {
  return {
    ...record,
    source: snapshotSkillSource(record.source),
  };
}

export function snapshotSkillInstallRecords(
  records: Iterable<SkillInstallRecord>,
): SkillInstallRecord[] {
  return Array.from(records, snapshotSkillInstallRecord);
}
