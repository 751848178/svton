import test from 'node:test';
import assert from 'node:assert/strict';
import type { LookupAddress, LookupOptions } from 'node:dns';
import { pinnedLookup } from './pinned-lookup.js';

function result(lookup: ReturnType<typeof pinnedLookup>, options: LookupOptions) {
  let value: { address: string | LookupAddress[]; family?: number } | undefined;
  lookup('original.test', options, (error, address, family) => {
    assert.equal(error, null); value = { address, family };
  });
  assert(value); return value;
}
test('all:true receives an address array, while false and omitted all receive one address', () => {
  for (const pin of [{ address: '93.184.216.34', family: 4 }, { address: '2001:db8::1', family: 6 }]) {
    const lookup = pinnedLookup(pin);
    assert.deepEqual(result(lookup, { all: true }), { address: [pin], family: undefined });
    for (const options of [{ all: false }, {}]) assert.deepEqual(result(lookup, options), pin);
  }
});
test('input or callback-array mutation cannot change the captured connection pin', () => {
  const address = { address: '93.184.216.34', family: 4 }, lookup = pinnedLookup(address);
  address.address = '127.0.0.1';
  const first = result(lookup, { all: true }).address as LookupAddress[];
  first[0]!.address = '169.254.169.254'; first.push({ address: '10.0.0.1', family: 4 });
  assert.deepEqual(result(lookup, {}), { address: '93.184.216.34', family: 4 });
  assert.deepEqual(result(lookup, { all: true }).address, [{ address: '93.184.216.34', family: 4 }]);
});
