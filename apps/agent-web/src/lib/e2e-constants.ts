/**
 * E2E constants shared between the browser seam (e2e-provider.ts) and the
 * Node-side Playwright helpers (e2e/helpers.ts). Kept in a separate module so
 * the test harness does not pull the pi-ai faux-provider import graph.
 */
export const E2E_FLAG_KEY = 'agent-web:e2e';
export const E2E_QUEUE_GLOBAL = '__SVTON_E2E_QUEUE__';
export const E2E_ERROR_MARKER = '__svton_e2e_error__';
export const E2E_POST_TURN_PROMPT = '__svton_e2e_post_turn__';
export const E2E_TIMELINE_SKILL_TRIGGER = 'activate-e2e-timeline-skill';
