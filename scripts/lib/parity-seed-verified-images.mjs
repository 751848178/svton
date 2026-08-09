const BUILD_COMMANDS = new Set(["up", "reset"]);

export async function verifiedImagesForSeedCommand(options) {
  if (![...BUILD_COMMANDS, "reset-bootstrap"].includes(options.command)) {
    return undefined;
  }
  if (BUILD_COMMANDS.has(options.command)) return options.build();
  const imageIds = await options.load(options.manifestPath, options.runtime);
  if (!imageIds) throw verifiedImageError("manifest-image-ids-missing");
  options.verifyRunning(options.runtime, imageIds);
  return imageIds;
}

function verifiedImageError(reason) {
  return new Error(`PARITY_SEED_VERIFIED_IMAGES_INVALID: ${reason}`);
}
