const BUILD_COMMANDS = new Set(["up", "reset"]);
const LOAD_COMMANDS = new Set(["reset-bootstrap"]);

export async function verifiedImagesForSeedCommand(options) {
  if (options.command === "build") return options.build();
  const loadPrebuilt =
    BUILD_COMMANDS.has(options.command) && options.reusePrebuilt === true;
  if (!BUILD_COMMANDS.has(options.command) && !LOAD_COMMANDS.has(options.command)) {
    return undefined;
  }
  if (BUILD_COMMANDS.has(options.command) && !loadPrebuilt) {
    return options.build();
  }
  const imageIds = await options.load(options.manifestPath, options.runtime);
  if (!imageIds) throw verifiedImageError("manifest-image-ids-missing");
  if (LOAD_COMMANDS.has(options.command)) {
    options.verifyRunning(options.runtime, imageIds);
  }
  return imageIds;
}

function verifiedImageError(reason) {
  return new Error(`PARITY_SEED_VERIFIED_IMAGES_INVALID: ${reason}`);
}
