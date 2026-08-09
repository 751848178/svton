export async function captureRouteAuditBestEffort(
  captureRouteAudit,
  root,
  context,
) {
  try {
    return await captureRouteAudit(root, context);
  } catch (error) {
    return {
      receipt: {
        status: "capture_failed",
        capturedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function cleanupFailedIsolatedAcceptance({
  captureRouteAudit,
  cleanup,
  root,
  context,
  error,
  routeAudit,
}) {
  const capturedAudit =
    routeAudit ||
    (await captureRouteAuditBestEffort(captureRouteAudit, root, context));
  await cleanup(context, error, capturedAudit);
}
