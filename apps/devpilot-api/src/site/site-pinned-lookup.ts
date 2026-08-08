import type { LookupFunction } from "node:net";
import type { ApprovedSiteProbeTarget } from "./site-probe-target.types";

export function createPinnedLookup(
  target: Pick<ApprovedSiteProbeTarget, "address" | "family">,
): LookupFunction {
  return ((_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      callback(null, [{ address: target.address, family: target.family }]);
      return;
    }
    callback(null, target.address, target.family);
  }) as LookupFunction;
}
