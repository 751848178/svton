export function summarizePositiveGateHistory(rows) {
  const items = rows.map((row) => ({
    id: row.id,
    stage: row.stage,
    phase: row.phase,
    allowed: row.allowed,
    blockerGateIds: list(row.blockerGateIds),
    manualGateIds: list(row.manualGateIds),
    confirmedManualGateIds: list(row.confirmedManualGateIds),
    checkpoint: record(row.inputSnapshot).checkpoint ?? null,
    createdAt: row.createdAt,
  }));
  const p03Blocked = items.filter((item) =>
    item.allowed === false && item.stage === "production" &&
    item.phase === "promote" && item.manualGateIds.includes("P03") &&
    !item.confirmedManualGateIds.includes("P03"),
  );
  const c03Blocked = items.filter((item) =>
    item.allowed === false && item.stage === "build" &&
    item.phase === "commit" && item.manualGateIds.includes("C03"),
  );
  const stagingBlocked = items.filter((item) =>
    item.allowed === false && item.stage === "staging" &&
    item.phase === "build" && expectedStagingBlockers(item.blockerGateIds),
  );
  const expectedBlocked = [...p03Blocked, ...c03Blocked, ...stagingBlocked];
  const confirmedP03 = items.filter((item) =>
    item.allowed === true && item.stage === "production" &&
    item.phase === "promote" && item.confirmedManualGateIds.includes("P03"),
  );
  return {
    items,
    decisionCount: items.length,
    expectedP03BlockedCount: p03Blocked.length,
    expectedC03BlockedCount: c03Blocked.length,
    expectedStagingBlockedCount: stagingBlocked.length,
    unexpectedBlockedCount: items.filter((item) =>
      item.allowed === false && !expectedBlocked.includes(item)).length,
    confirmedP03DecisionCount: confirmedP03.length,
    confirmedC03DecisionCount: items.filter((item) =>
      item.allowed && item.confirmedManualGateIds.includes("C03")).length,
    recoveredStagingDecisionCount: items.filter((item) =>
      item.allowed && item.stage === "staging" && item.phase === "build").length,
    allowedDecisionsHaveNoBlockers: items
      .filter((item) => item.allowed)
      .every((item) => item.blockerGateIds.length === 0),
  };
}

function expectedStagingBlockers(value) {
  const expected = new Set(["B01", "B02", "B03", "B06", "B09"]);
  return value.length > 0 && value.every((gateId) => expected.has(gateId));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
