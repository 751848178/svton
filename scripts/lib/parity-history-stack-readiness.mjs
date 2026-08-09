const TARGET_MARKER = "Parity Target Workload";
const MAX_TARGET_BYTES = 1024 * 1024;

export async function waitForHistoryStackReadiness(options) {
  const attempts = options.attempts ?? 60;
  const delayMs = options.delayMs ?? 2_000;
  if (
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 120 ||
    !Number.isInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 5_000
  ) {
    throw readinessError("policy");
  }
  const urls = [
    requireLoopbackUrl(options.apiHealthUrl),
    requireLoopbackUrl(options.webUrl),
    requireLoopbackUrl(options.targetUrl),
  ];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const [api, web, target] = await Promise.all([
      probe(fetchImpl, urls[0]),
      probe(fetchImpl, urls[1]),
      probe(fetchImpl, urls[2], TARGET_MARKER),
    ]);
    if (api.ok && web.ok && target.ok && target.marker) {
      return Object.freeze({
        status: "ready",
        attempt,
        apiStatus: api.status,
        webStatus: web.status,
        targetStatus: target.status,
        targetMarker: TARGET_MARKER,
      });
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  throw readinessError("attempts-exhausted");
}

async function probe(fetchImpl, url, marker) {
  try {
    const response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    const bytes = marker
      ? new Uint8Array(await response.arrayBuffer())
      : new Uint8Array();
    if (bytes.byteLength > MAX_TARGET_BYTES)
      throw readinessError("target-size");
    const body = marker ? new TextDecoder().decode(bytes) : "";
    return {
      ok: response.ok,
      status: response.status,
      marker: marker ? body.includes(marker) : true,
    };
  } catch {
    return { ok: false, status: null, marker: false };
  }
}

function requireLoopbackUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.port ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw readinessError("origin");
  }
  return url.toString();
}

function readinessError(reason) {
  return new Error(`F456_STACK_READINESS_INVALID:${reason}`);
}
