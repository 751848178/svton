export function createApi(apiUrl) {
  return async function api(method, path, options = {}) {
    const token = options.token || options.auth?.token;
    const teamId = options.teamId || options.auth?.teamId;
    const headers = { accept: "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (teamId) headers["x-team-id"] = teamId;
    if (options.body) headers["content-type"] = "application/json";
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!(options.ok || [200]).includes(res.status)) {
      throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
    }
    return { status: res.status, body };
  };
}

export function unwrap(result) {
  return result.body?.data ?? result.body;
}

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
