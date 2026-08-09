export function unexpectedNetworkFailures(evidence = {}) {
  const documentOrigins = successfulDocumentOrigins(evidence.httpResponses);
  return (evidence.failedRequests || []).filter(
    (failure) => !expectedNextRscAbort(failure, documentOrigins),
  );
}

function expectedNextRscAbort(failure, documentOrigins) {
  if (
    failure?.canceled !== true ||
    failure?.errorText !== "net::ERR_ABORTED" ||
    failure?.type !== "Fetch"
  ) {
    return false;
  }
  try {
    const url = new URL(failure.url);
    return documentOrigins.has(url.origin) && url.searchParams.has("_rsc");
  } catch {
    return false;
  }
}

function successfulDocumentOrigins(responses = []) {
  return new Set(
    responses
      .filter(
        (response) =>
          response?.type === "Document" &&
          response.status >= 200 &&
          response.status < 400,
      )
      .map((response) => new URL(response.url).origin),
  );
}
