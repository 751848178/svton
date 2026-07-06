import { Injectable } from "@nestjs/common";

@Injectable()
export class MonitoringAlertServiceSloConditionService {
  asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }

  readPercent(value: unknown, fallback: number, min: number, max: number) {
    const rawNumber =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : fallback;
    const number = Number.isFinite(rawNumber) ? rawNumber : fallback;
    return Number(Math.min(Math.max(number, min), max).toFixed(2));
  }
}
