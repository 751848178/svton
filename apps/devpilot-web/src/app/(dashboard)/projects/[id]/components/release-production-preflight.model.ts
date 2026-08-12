import type { ProductionReleasePreview } from "../types/release-order.types";

export function productionPreflightView(
  preflight: ProductionReleasePreview["preflight"] | undefined,
  locale: string,
) {
  const blocker = preflight?.decision.blockerGateIds[0] ||
    preflight?.decision.manualGateIds[0] ||
    preflight?.decision.integrityErrors[0]?.split(":")[0];
  return {
    value: preflight,
    reason: (() => {
      const reason = preflight?.checks.find((check) => check.id === blocker)?.reason;
      return locale.startsWith('zh') ? reason?.zh : reason?.en;
    })(),
  };
}
