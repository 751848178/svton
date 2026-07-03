export function riskFromAlertSeverity(severity: string) {
  if (severity === "critical") return "high";
  if (severity === "warning") return "medium";
  return "low";
}
