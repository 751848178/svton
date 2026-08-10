#!/usr/bin/env node
import assert from "node:assert/strict";
import { routeControlUpstreamUrl } from "./parity-route-control-upstream.mjs";

assert.equal(
  routeControlUpstreamUrl("http://target/", "/asset?q=1").href,
  "http://target/asset?q=1",
);
assert.equal(
  routeControlUpstreamUrl("http://target/missing", "/").href,
  "http://target/missing",
);
assert.equal(
  routeControlUpstreamUrl("http://target/prefix/", "/asset?q=1").href,
  "http://target/prefix/asset?q=1",
);
assert.equal(
  routeControlUpstreamUrl("http://target/fixed?token=public", "/").href,
  "http://target/fixed?token=public",
);

process.stdout.write("route-control upstream self-test passed\n");
