import { useLocale } from 'next-intl';
import type { ProductionReleasePreview } from '../types/release-order.types';
import { productionPreflightView } from '../components/release-production-preflight.model';

export function useProductionPreflightView(
  preflight: ProductionReleasePreview['preflight'] | undefined,
) {
  return productionPreflightView(preflight, useLocale());
}
