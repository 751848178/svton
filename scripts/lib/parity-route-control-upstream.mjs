export function routeControlUpstreamUrl(proxyTarget, requestPath) {
  const upstream = new URL(proxyTarget);
  const request = new URL(requestPath, "http://route-control.local");
  const basePath =
    upstream.pathname === "/" ? "" : upstream.pathname.replace(/\/$/, "");
  const suffix = request.pathname === "/" ? "" : request.pathname;
  upstream.pathname = `${basePath}${suffix}` || "/";
  if (request.search) upstream.search = request.search;
  upstream.hash = "";
  return upstream;
}
