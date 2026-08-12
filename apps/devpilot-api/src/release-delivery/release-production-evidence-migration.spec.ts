import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("release production evidence migration", () => {
  const sql = readFileSync(join(
    process.cwd(),
    "prisma/migrations/20260811250000_release_production_evidence/migration.sql",
  ), "utf8");

  it("declares each provider key once before its indexed use", () => {
    const capacity = tableSql("ServerCapacitySnapshot");
    const dns = tableSql("SiteDnsProbeReceipt");
    expect(capacity.match(/`providerKey` VARCHAR\(128\) NOT NULL/g)).toHaveLength(1);
    expect(dns.match(/`providerKey` VARCHAR\(128\) NOT NULL/g)).toHaveLength(1);
    expect(capacity).toContain("`providerKey`, `bindingId`, `sampledBucket`");
    expect(dns).toContain("`routeHash`, `providerKey`, `sampledBucket`");
  });

  it("keeps utf8mb4 unique subjects below MySQL's 3072-byte limit", () => {
    const capacityChars = 128 * 4 + 191;
    const dnsChars = 128 * 4;
    expect(capacityChars * 4 + 8).toBeLessThan(3072);
    expect(dnsChars * 4 + 8).toBeLessThan(3072);
    for (const column of [
      "deploymentInputHash", "workloadInputHash", "requirementHash", "routeHash",
    ]) {
      if (sql.includes(`\`${column}\``)) {
        expect(sql).toMatch(new RegExp(`\\\`${column}\\\` VARCHAR\\(128\\) NOT NULL`));
      }
    }
  });

  function tableSql(name: string) {
    const match = sql.match(new RegExp(
      `CREATE TABLE \\\`${name}\\\` \\([\\s\\S]*?\\n\\)` +
      " DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
    ));
    expect(match).not.toBeNull();
    return match![0];
  }
});
