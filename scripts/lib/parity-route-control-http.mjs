import { timingSafeEqual } from "node:crypto";

const MAX_BODY_BYTES = 64 * 1024;

export function authorized(value, token) {
  const claimed = Buffer.from(value || "");
  const expected = Buffer.from(`Bearer ${token}`);
  return claimed.length === expected.length && timingSafeEqual(claimed, expected);
}

export async function readRouteControlJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("request_too_large");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("request_json_invalid"); }
}

export function routeControlJson(response, status, value) {
  response.statusCode = status;
  if (status === 204) return response.end();
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(value));
}

export function routeControlError(response, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
  routeControlJson(response, status, { error: error instanceof Error
    ? error.message : "invalid_request" });
}
