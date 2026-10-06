import assert from "node:assert/strict";
import {
  normalizeRouteControlTarget,
  parseRouteControlUpstreamMap,
  resolveRouteControlUpstream,
} from "./parity-route-control-target.mjs";

assert.equal(normalizeRouteControlTarget("@parity/web:80"), "@parity/web:80");
assert.equal(
  normalizeRouteControlTarget("http://target-workload:80"),
  "http://target-workload/",
);
const mapping = parseRouteControlUpstreamMap(
  JSON.stringify({ "@parity/web:80": "http://target-workload:80" }),
);
assert.equal(
  resolveRouteControlUpstream("@parity/web:80", mapping),
  "http://target-workload/",
);
assert.throws(
  () => resolveRouteControlUpstream("@parity/api:3000", mapping),
  /proxy_target_unavailable/,
);
assert.throws(
  () => parseRouteControlUpstreamMap('{"@parity/web:80":"file:///tmp/app"}'),
  /invalid_proxy_target/,
);
process.stdout.write("route-control target mapping self-test passed\n");
