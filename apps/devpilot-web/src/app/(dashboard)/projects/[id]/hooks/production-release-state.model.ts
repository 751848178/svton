import type { ProductionReleasePreview } from '../types/release-order.types';

export type ProductionErrorKind = 'load' | 'action' | null;

export interface ProductionState {
  scope: string;
  preview: ProductionReleasePreview | null;
  loading: boolean;
  confirming: boolean;
  refreshing: boolean;
  error: string;
  errorKind: ProductionErrorKind;
}

export function loadingProductionState(scope: string): ProductionState {
  return {
    scope,
    preview: null,
    loading: true,
    confirming: false,
    refreshing: false,
    error: '',
    errorKind: null,
  };
}

export function inactiveProductionState(scope: string): ProductionState {
  return { ...loadingProductionState(scope), loading: false };
}

export function failedProductionState(
  scope: string,
  error: string,
  errorKind: Exclude<ProductionErrorKind, null>,
): ProductionState {
  return { ...loadingProductionState(scope), loading: false, error, errorKind };
}
