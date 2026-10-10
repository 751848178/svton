import type { LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';

/** Adapt one already-approved address to Node's single/all lookup contracts.
 * The captured pin is never resolved again or expanded to other addresses. */
export function pinnedLookup(address: LookupAddress): LookupFunction {
  const pinned = { address: address.address, family: address.family };
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [{ ...pinned }]);
    else callback(null, pinned.address, pinned.family);
  };
}
