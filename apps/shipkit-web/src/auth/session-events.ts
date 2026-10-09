let epoch = 0;
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();

export function authEpoch() { return epoch; }
export function retireAuthRequests() {
  epoch++;
  for (const controller of requests) controller.abort();
  requests.clear();
}
export function trackProtectedRequest(controller: AbortController) {
  requests.add(controller);
  return () => { requests.delete(controller); };
}
export function notifyUnauthorized(requestEpoch: number) {
  if (requestEpoch === epoch) for (const listener of listeners) listener();
}
export function onUnauthorized(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
