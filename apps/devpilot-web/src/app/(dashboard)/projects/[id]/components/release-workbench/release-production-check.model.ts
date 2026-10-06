export {
  productionApprovalCheck,
  productionCheckCounts,
  productionRouteTargets,
} from '../../utils/release-production-preview.model';
export type { ProductionRouteTarget } from '../../utils/release-production-preview.model';

export type ProductionCheckTone = 'success' | 'danger' | 'warning' | 'neutral';

export function productionCheckTone(status: string): ProductionCheckTone {
  if (status === 'checked') return 'success';
  if (status === 'blocked') return 'danger';
  if (status === 'warning' || status === 'manual') return 'warning';
  return 'neutral';
}

export function productionCheckStatusKey(status: string) {
  return ['checked', 'unchecked', 'blocked', 'warning', 'manual', 'unavailable'].includes(status)
    ? `releaseGateStatus.${status}`
    : 'releaseStagingCheckStatus.unavailable';
}
