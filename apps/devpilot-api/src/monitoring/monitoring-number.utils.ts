export function readPositiveInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const rawNumber =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : fallback;
  const number = Number.isFinite(rawNumber) ? Math.floor(rawNumber) : fallback;
  return Math.min(Math.max(number, min), max);
}
