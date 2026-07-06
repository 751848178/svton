import {
  LogRedactionPolicy,
  redactLogMessage,
  redactLogValue,
} from "./log-redaction";

export function readAliyunSlsResponseRows(
  response: unknown,
): Array<Record<string, unknown>> {
  const record = asRecord(response);
  const body = record.body;
  if (Array.isArray(body)) {
    return body.filter((item): item is Record<string, unknown> =>
      isRecord(item),
    );
  }

  const bodyRecord = asRecord(body);
  for (const key of ["logs", "data", "items", "rows"]) {
    const value = bodyRecord[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> =>
        isRecord(item),
      );
    }
  }

  return [];
}

export function redactAliyunSlsRows(
  rows: Array<Record<string, unknown>>,
  redactionPolicy: LogRedactionPolicy,
) {
  return rows.map((row) => redactLogValue(row, redactionPolicy)) as Array<
    Record<string, unknown>
  >;
}

export function formatAliyunSlsLogLine(
  row: Record<string, unknown>,
  redactionPolicy: LogRedactionPolicy,
) {
  const timestamp = resolveRowTimestamp(row);
  const level = asString(row.level) || asString(row.Level) || "info";
  const message = resolveRowMessage(row);
  return redactLogMessage(
    `${timestamp.toISOString()} ${level.toUpperCase()} ${message}`,
    redactionPolicy,
  );
}

export function queryContainsAnalyticSql(query: string) {
  return query.includes("|") || /\bselect\b/i.test(query);
}

function resolveRowTimestamp(row: Record<string, unknown>) {
  const raw = row.__time__ ?? row.time ?? row.timestamp ?? row.Time;
  const numeric =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw)
        ? Number.parseInt(raw, 10)
        : null;
  if (numeric !== null && Number.isFinite(numeric)) {
    const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(milliseconds);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof raw === "string") {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function resolveRowMessage(row: Record<string, unknown>) {
  const direct =
    asString(row.message) ||
    asString(row.Message) ||
    asString(row.content) ||
    asString(row.msg) ||
    asString(row.log);
  if (direct) return direct;

  const material: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (
      ["__time__", "time", "timestamp", "Time", "level", "Level"].includes(key)
    )
      continue;
    material[key] = value;
  }
  return JSON.stringify(material);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
