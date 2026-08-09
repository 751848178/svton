const SERVICE_NAMES = Object.freeze(["api", "web", "route-control"]);
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;

export function requireRuntimeImageIds(value) {
  if (!value || typeof value !== "object") throw imageIdentityError("missing");
  const ids = Object.fromEntries(
    SERVICE_NAMES.map((service) => {
      const id = value[service];
      if (!IMAGE_ID_PATTERN.test(String(id || ""))) {
        throw imageIdentityError(`invalid:${service}`);
      }
      return [service, id];
    }),
  );
  return Object.freeze(ids);
}

export function runtimeImageReferences(runtime) {
  return {
    api: runtime.apiImage,
    web: runtime.webImage,
    "route-control": runtime.routeControlImage,
  };
}

export function collectRuntimeImages(runtime, execute, expectedImageIds) {
  if (expectedImageIds) {
    return inspectExistingImages(
      Object.values(requireRuntimeImageIds(expectedImageIds)),
      execute,
    );
  }
  const ids = new Set();
  for (const image of Object.values(runtimeImageReferences(runtime))) {
    const listed = execute([
      "image",
      "ls",
      "--filter",
      `reference=${image}`,
      "--format={{.ID}}",
    ]);
    requireSuccess(listed, "image-list");
    for (const id of lines(listed.stdout)) ids.add(id);
  }
  return inspectExistingImages([...ids], execute);
}

export function resolveRuntimeImageId(image, execute) {
  const result = execute(["image", "inspect", image]);
  requireSuccess(result, "image-inspect-by-tag");
  return JSON.parse(result.stdout)[0]?.Id;
}

function inspectExistingImages(ids, execute) {
  return ids.flatMap((id) => {
    const result = execute(["image", "inspect", id]);
    if (result.status !== 0 && /no such image/i.test(String(result.stderr))) {
      return [];
    }
    requireSuccess(result, "image-inspect");
    const record = JSON.parse(result.stdout)[0];
    return [{ id: record.Id, labels: record?.Config?.Labels || {} }];
  });
}

function lines(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function requireSuccess(result, operation) {
  if (result.status !== 0) {
    throw imageIdentityError(`${operation}:${result.stderr || result.status}`);
  }
}

function imageIdentityError(reason) {
  return new Error(`PARITY_RUNTIME_IMAGE_IDENTITY_INVALID: ${reason}`);
}
