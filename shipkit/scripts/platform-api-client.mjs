import assert from 'node:assert/strict';
export const apiRoot = process.env.SHIPKIT_TEST_API ?? 'http://127.0.0.1:8770/api';
export async function call(method, route, body, expected) {
  const response = await fetch(`${apiRoot}${route}`, { method,
    headers: { 'x-shipkit-local': '1', ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  if (expected) { assert.equal(response.status, expected, JSON.stringify(value).slice(0, 500)); return value; }
  if (!response.ok) throw new Error(`${method} ${route} returned ${response.status}: ${JSON.stringify(value).slice(0, 500)}`);
  return value;
}
export async function finishTask(id) {
  for (let i = 0; i < 360; i++) {
    const detail = await call('GET', `/tasks/${id}`);
    if (['succeeded', 'failed', 'cancelled', 'interrupted'].includes(detail.task.status) && detail.task.finishedAt) return detail;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Task ${id} timeout`);
}
export async function until(check, label) {
  for (let i = 0; i < 240; i++) {
    const value = await check(); if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
