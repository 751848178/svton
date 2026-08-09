export async function cleanupOwnedC5Resources(input) {
  const failures = [];
  let builderReceipt;
  let residualResources;
  await attempt(async () => {
    builderReceipt = await input.destroyBuilder();
  }, failures);
  await attempt(input.destroyRuntime, failures);
  await attempt(input.removeFixture, failures);
  await attempt(async () => input.assertNoBuilder(), failures);
  await attempt(async () => {
    residualResources = input.assertNoRuntimeResources();
  }, failures);
  if (failures.length > 0) {
    throw new AggregateError(failures, "isolated C5 cleanup failed");
  }
  return { builderReceipt, residualResources };
}

async function attempt(operation, failures) {
  try {
    await operation();
  } catch (error) {
    failures.push(error);
  }
}
