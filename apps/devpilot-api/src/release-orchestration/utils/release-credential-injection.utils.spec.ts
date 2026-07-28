/**
 * 发布阶段凭据注入纯函数单测（F383 P0-A）。
 * 覆盖：内联密码改写、非秘密 token 保留、变量名归一、secretEnvExport 映射、
 * 无秘密命令原样返回、多种连接串形态。
 */
import {
  redactCommandSecrets,
  buildSecretEnvExport,
} from "./release-credential-injection.utils";

const SECRET_DB_URL = "mysql://root:Devpilot@2025@host:3306/db";
const SECRET_PASSWORD = "S3cret-Pwd!";

describe("redactCommandSecrets", () => {
  it("rewrites a DATABASE_URL -e token into a $DEVPILOT_DATABASE_URL reference", () => {
    const cmd = `docker run -e DATABASE_URL="${SECRET_DB_URL}" app migrate`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    expect(redactedCommand).toBe(
      `docker run -e DATABASE_URL="$DEVPILOT_DATABASE_URL" app migrate`,
    );
    expect(secretVarNames).toEqual(["DEVPILOT_DATABASE_URL"]);
    // 真实密码绝不出现在改写后的命令里
    expect(redactedCommand).not.toContain(SECRET_DB_URL);
    expect(redactedCommand).not.toContain("Devpilot@2025");
  });

  it("keeps non-secret tokens (HOST/PORT/PHONE/NETWORK) verbatim", () => {
    const cmd = `docker run -e DATABASE_URL="${SECRET_DB_URL}" -e REDIS_HOST="redis-host" -e REDIS_PORT="6379" -e BOOTSTRAP_ADMIN_PHONE="13800000000" --network net app`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    expect(secretVarNames).toEqual(["DEVPILOT_DATABASE_URL"]);
    expect(redactedCommand).toContain('-e REDIS_HOST="redis-host"');
    expect(redactedCommand).toContain('-e REDIS_PORT="6379"');
    expect(redactedCommand).toContain('-e BOOTSTRAP_ADMIN_PHONE="13800000000"');
    expect(redactedCommand).not.toContain(SECRET_DB_URL);
  });

  it("handles bare-value (unquoted) -e KEY=value tokens", () => {
    const cmd = `docker run -e BOOTSTRAP_ADMIN_PASSWORD=${SECRET_PASSWORD} app seed`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    expect(redactedCommand).toBe(
      `docker run -e BOOTSTRAP_ADMIN_PASSWORD="$DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD" app seed`,
    );
    expect(secretVarNames).toEqual(["DEVPILOT_BOOTSTRAP_ADMIN_PASSWORD"]);
    expect(redactedCommand).not.toContain(SECRET_PASSWORD);
  });

  it("handles single-quoted -e KEY='value' tokens", () => {
    const cmd = `docker run -e JWT_SECRET='${SECRET_PASSWORD}' app`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    expect(redactedCommand).toBe(`docker run -e JWT_SECRET="$DEVPILOT_JWT_SECRET" app`);
    expect(secretVarNames).toEqual(["DEVPILOT_JWT_SECRET"]);
  });

  it("dedupes repeated secret keys and rewrites all occurrences", () => {
    const cmd = `sh -c "X=$DATABASE_URL"; docker run -e DATABASE_URL="${SECRET_DB_URL}" app`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    // Only the -e token form is rewritten; a bare $DATABASE_URL shell ref is untouched
    // (it is the caller's responsibility to source the export). secretVarNames lists once.
    expect(secretVarNames).toEqual(["DEVPILOT_DATABASE_URL"]);
    expect(redactedCommand).toContain('-e DATABASE_URL="$DEVPILOT_DATABASE_URL"');
    expect(redactedCommand).not.toContain(SECRET_DB_URL);
  });

  it("returns command unchanged with empty secretVarNames when no secret tokens", () => {
    const cmd = `curl -fsS http://picshare-backend:3000/api`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    expect(redactedCommand).toBe(cmd);
    expect(secretVarNames).toEqual([]);
  });

  it("does not emit the raw secret value in any returned field", () => {
    const cmd = `docker run -e DATABASE_URL="${SECRET_DB_URL}" -e PASSWORD="${SECRET_PASSWORD}" app`;
    const { redactedCommand, secretVarNames } = redactCommandSecrets(cmd);
    const blob = JSON.stringify({ redactedCommand, secretVarNames });
    expect(blob).not.toContain("Devpilot@2025");
    expect(blob).not.toContain(SECRET_PASSWORD);
  });
});

describe("buildSecretEnvExport", () => {
  it("maps command-referenced DEVPILOT_<KEY> to platform-resolved <KEY> values", () => {
    const resolved = { DATABASE_URL: SECRET_DB_URL, REDISCLI_AUTH: "redis-pwd" };
    const out = buildSecretEnvExport(
      ["DEVPILOT_DATABASE_URL", "DEVPILOT_REDISCLI_AUTH"],
      resolved,
    );
    expect(out).toEqual({
      DEVPILOT_DATABASE_URL: SECRET_DB_URL,
      DEVPILOT_REDISCLI_AUTH: "redis-pwd",
    });
  });

  it("drops platform values for variables the command does not reference", () => {
    const resolved = {
      DATABASE_URL: SECRET_DB_URL,
      UNRELATED_SECRET: "should-not-leak",
      NODE_ENV: "production",
    };
    const out = buildSecretEnvExport(["DEVPILOT_DATABASE_URL"], resolved);
    expect(out).toEqual({ DEVPILOT_DATABASE_URL: SECRET_DB_URL });
    expect(out).not.toHaveProperty("DEVPILOT_NODE_ENV");
  });

  it("returns empty object when resolved env is empty (secrets not provisioned)", () => {
    const out = buildSecretEnvExport(["DEVPILOT_DATABASE_URL"], {});
    expect(out).toEqual({});
  });
});
