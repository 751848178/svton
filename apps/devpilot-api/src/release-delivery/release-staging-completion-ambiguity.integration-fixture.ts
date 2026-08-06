import type { ReleaseStagingRepository } from "./release-staging.repository";

export async function deployWithStagingCompletionAckLoss<T>(
  repository: ReleaseStagingRepository,
  deploy: () => Promise<T>,
) {
  const original = repository.finish.bind(repository);
  let rejectAcknowledgement = true;
  const spy = jest
    .spyOn(repository, "finish")
    .mockImplementation(async (input) => {
      const result = await original(input);
      if (input.status === "completed" && rejectAcknowledgement) {
        rejectAcknowledgement = false;
        throw new Error("simulated committed completion acknowledgement loss");
      }
      return result;
    });
  try {
    return await deploy();
  } finally {
    spy.mockRestore();
  }
}
