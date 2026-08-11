import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const FIRST = "20260811120000";
const LAST = "20260811190000";

describe("release experience MySQL migration identifiers", () => {
  const root = join(process.cwd(), "prisma/migrations");
  const migrations = readdirSync(root).filter((name) => {
    const timestamp = name.slice(0, 14);
    return timestamp >= FIRST && timestamp <= LAST;
  }).sort();

  it("covers every additive migration in the F674 release chain", () => {
    expect(migrations.map((name) => name.slice(0, 14))).toEqual([
      "20260811120000", "20260811130000", "20260811140000", "20260811150000",
      "20260811160000", "20260811170000", "20260811180000", "20260811190000",
    ]);
  });

  it("keeps every explicit index and constraint within MySQL's 64-byte limit", () => {
    const identifiers = migrations.flatMap((migration) => {
      const sql = readFileSync(join(root, migration, "migration.sql"), "utf8");
      return [
        ...sql.matchAll(/(?:CREATE\s+)?(?:UNIQUE\s+)?INDEX\s+`([^`]+)`/gi),
        ...sql.matchAll(/\bCONSTRAINT\s+`([^`]+)`/gi),
      ].map((match) => ({ migration, name: match[1], bytes: Buffer.byteLength(match[1]) }));
    });
    expect(identifiers.length).toBeGreaterThan(0);
    expect(identifiers.filter(({ bytes }) => bytes > 64)).toEqual([]);
  });
});
