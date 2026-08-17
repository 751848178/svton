type LegacyPromotionCommand = {
  id: string;
  phase: string;
  legacyReconcileReason: string | null;
};

export function presentLegacyPromotionRecovery(commands: LegacyPromotionCommand[]) {
  if (commands.length === 0) return null;
  const command = commands.length === 1 ? commands[0] : null;
  return {
    status: command ? "required" as const : "ambiguous" as const,
    commandIds: commands.map((item) => item.id),
    phase: command?.phase ?? null,
    reason: command?.legacyReconcileReason ?? null,
    reasonCode: command
      ? "legacy_promotion_reconciliation_required" as const
      : "legacy_promotion_reconciliation_ambiguous" as const,
  };
}
