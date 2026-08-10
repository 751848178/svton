const ROLES = Object.freeze(["staging", "production"]);
const EXPECTED_KEYS = Object.freeze([
  "productionRecoveryVersionId",
  "productionUpgradeVersionId",
  "stagingRecoveryVersionId",
  "stagingUpgradeVersionId",
]);

export function environmentVersionMarkers({ text, html, expected }) {
  requireValue(typeof text === "string", "text");
  requireValue(typeof html === "string", "html");
  validateExpected(expected);
  const rows = versionRows(html);
  return Object.freeze({
    pageTitle: text.includes("环境版本"),
    changeLogTable: text.includes("环境变更记录"),
    stagingUpgradeKind: hasRow(
      rows,
      "staging",
      "upgrade",
      expected.stagingUpgradeVersionId,
    ),
    stagingRecoveryKind: hasRow(
      rows,
      "staging",
      "recovery",
      expected.stagingRecoveryVersionId,
    ),
    productionUpgradeKind: hasRow(
      rows,
      "production",
      "upgrade",
      expected.productionUpgradeVersionId,
    ),
    productionRecoveryKind: hasRow(
      rows,
      "production",
      "recovery",
      expected.productionRecoveryVersionId,
    ),
    currentSuccess: ROLES.every((role) =>
      rows.some(
        (row) => row.role === role && row.current && row.text.includes("成功"),
      ),
    ),
  });
}

function versionRows(html) {
  return [...html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)]
    .map((match) => ({
      role: attribute(match[1], "data-environment-role"),
      kind: attribute(match[1], "data-version-kind"),
      versionId: attribute(match[1], "data-version-id"),
      current: attribute(match[1], "data-version-current") === "true",
      text: match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((row) => ROLES.includes(row.role));
}

function attribute(source, name) {
  const match = source.match(new RegExp(`(?:^|\\s)${name}="([^"]+)"`));
  return match?.[1] || "";
}

function hasRow(rows, role, kind, versionId) {
  return rows.some(
    (row) =>
      row.role === role && row.kind === kind && row.versionId === versionId,
  );
}

function validateExpected(expected) {
  requireValue(
    expected !== null &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      JSON.stringify(Object.keys(expected).sort()) ===
        JSON.stringify(EXPECTED_KEYS),
    "expected-keys",
  );
  const values = Object.values(expected);
  requireValue(
    values.every((value) => typeof value === "string" && value.length > 0),
    "expected-values",
  );
  requireValue(new Set(values).size === values.length, "expected-distinctness");
}

function requireValue(value, reason) {
  if (!value) throw new Error(`E2E_HISTORY_MARKER_INVALID:${reason}`);
}
