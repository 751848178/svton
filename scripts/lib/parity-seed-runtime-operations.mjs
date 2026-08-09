export function createParitySeedRuntimeOperations({
  compose,
  run,
  dbName,
  dbUrl,
}) {
  async function repairApiFixtureMount() {
    const out = compose(
      [
        "exec",
        "-T",
        "api",
        "sh",
        "-lc",
        "test -f /read-only-repositories/parity-app/package.json && echo OK || echo MISSING",
      ],
      { check: false },
    );
    if (out.stdout.trim() === "OK") return;
    console.log("[parity-seed] api fixture mount empty; force-recreating api");
    await compose(["up", "-d", "--force-recreate", "api"]);
  }

  async function dropCreateDb() {
    await compose([
      "exec",
      "-T",
      "mysql",
      "sh",
      "-lc",
      `mysql -uroot -ppassword -e 'DROP DATABASE IF EXISTS ${dbName}; CREATE DATABASE ${dbName};'`,
    ]);
    console.log(`[parity-seed] recreated database ${dbName}`);
  }

  async function migrateDeploy() {
    await run(
      "corepack",
      [
        "pnpm",
        "--filter",
        "@svton/devpilot-api",
        "exec",
        "prisma",
        "migrate",
        "deploy",
      ],
      { env: { ...process.env, DATABASE_URL: dbUrl } },
    );
    console.log(`[parity-seed] prisma migrate deploy applied on ${dbName}`);
  }

  async function waitHealthy(service, attempts) {
    for (let index = 0; index < attempts; index += 1) {
      if (containerHealth(service) === "healthy") return;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
    }
    throw new Error(`parity ${service} did not become healthy`);
  }

  function containerHealth(service) {
    const container = compose(["ps", "-q", service], {
      check: false,
    }).stdout.trim();
    if (!container) return "missing";
    return run(
      "docker",
      ["inspect", container, "--format={{.State.Health.Status}}"],
      { check: false },
    ).stdout.trim();
  }

  return {
    dropCreateDb,
    migrateDeploy,
    repairApiFixtureMount,
    waitApiHealthy: () => waitHealthy("api", 90),
    waitMysqlHealthy: () => waitHealthy("mysql", 60),
  };
}
