#!/usr/bin/env node
const apiUrl = (process.env.DEVPILOT_API_URL || "http://127.0.0.1:3211/api").replace(/\/+$/, "");
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const password = `TenantE2E-${stamp}`;

async function main() {
  const probe = await request("GET", "/auth/profile", {});
  if (probe.blocked) return printBlocked(probe.blocked);
  if (![401, 403].includes(probe.status)) {
    return printBlocked(`api_not_devpilot_auth_profile_status_${probe.status}`);
  }

  const userA = await ensureUser(`tenant-a-${stamp}@example.test`, password, "Tenant A");
  const userB = await ensureUser(`tenant-b-${stamp}@example.test`, password, "Tenant B");
  const teamA = await createTeam(userA.token, `Tenant A ${stamp}`);
  const teamB = await createTeam(userB.token, `Tenant B ${stamp}`);

  const ownTeam = await request("GET", `/teams/${teamA.id}`, { token: userA.token });
  assertStatus("owner can read own team", ownTeam, 200);

  const crossTeam = await request("GET", `/teams/${teamA.id}`, { token: userB.token });
  assertDenied("other user cannot read team A", crossTeam);

  const ownCapabilities = await request("GET", "/resource-control/capabilities", {
    token: userA.token,
    teamId: teamA.id,
  });
  assertStatus("team A can read resource capabilities", ownCapabilities, 200);

  const crossTeamHeader = await request("GET", "/resource-control/capabilities", {
    token: userB.token,
    teamId: teamA.id,
  });
  assertDenied("team B token cannot use team A header", crossTeamHeader);

  const teamBHappyPath = await request("GET", "/resource-control/capabilities", {
    token: userB.token,
    teamId: teamB.id,
  });
  assertStatus("team B own header still works", teamBHappyPath, 200);

  console.log(JSON.stringify({
    status: "passed",
    apiUrl,
    checks: [
      "owner can read own team",
      "other user cannot read team A",
      "team A can read resource capabilities",
      "team B token cannot use team A header",
      "team B own header still works",
    ],
    teams: { teamA: teamA.id, teamB: teamB.id },
  }, null, 2));
}

async function ensureUser(email, pass, name) {
  const registered = await request("POST", "/auth/register", {
    body: { email, password: pass, name },
  });
  if (![200, 201, 400, 409].includes(registered.status)) {
    throw new Error(`register ${email} unexpected status ${registered.status}`);
  }
  const login = await request("POST", "/auth/login", {
    body: { email, password: pass },
  });
  assertStatusIn(`login ${email}`, login, [200, 201]);
  const token = readToken(login.body);
  if (!token) throw new Error(`login ${email} did not return access token`);
  return { email, token };
}

async function createTeam(token, name) {
  const created = await request("POST", "/teams", {
    token,
    body: { name, description: "Permission tenant E2E" },
  });
  assertStatus(`create team ${name}`, created, 201);
  const team = unwrapData(created.body);
  if (!team?.id) throw new Error(`create team ${name} missing id`);
  return team;
}

async function request(method, path, options) {
  const headers = { accept: "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.teamId) headers["x-team-id"] = options.teamId;
  if (options.body) headers["content-type"] = "application/json";
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: parseJson(text), text };
  } catch (error) {
    return { status: 0, blocked: `api_unreachable:${error.message}` };
  }
}

function readToken(body) {
  const data = unwrapData(body);
  return data?.accessToken || body?.accessToken || data?.token || body?.token;
}

function unwrapData(body) {
  return body?.data || body;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function assertStatus(label, result, expected) {
  if (result.status !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${result.status}`);
  }
}

function assertStatusIn(label, result, expected) {
  if (!expected.includes(result.status)) {
    throw new Error(`${label}: expected one of ${expected.join(", ")}, got ${result.status}`);
  }
}

function assertDenied(label, result) {
  if (![401, 403, 404].includes(result.status)) {
    throw new Error(`${label}: expected denied status, got ${result.status}`);
  }
}

function printBlocked(reason) {
  console.log(JSON.stringify({ status: "blocked_external", apiUrl, reason }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
