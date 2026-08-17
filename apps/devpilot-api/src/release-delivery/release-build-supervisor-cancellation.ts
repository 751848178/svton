import { join } from "node:path";
import {
  sameWorkerIdentity,
  verifyWorkerCancellation,
  type ReleaseBuildWorkerCancellation,
  type ReleaseBuildWorkerRequest,
} from "./release-build-worker-envelope.policy";
import { readImmutableWorkerJson } from "./release-build-worker-exchange";
import { readReleaseBuildWorkerSecret } from "./release-build-worker-secret";

export function watchSupervisorCancellation(input: {
  inputDirectory: string;
  secretFile: string;
  request: ReleaseBuildWorkerRequest;
}) {
  const controller = new AbortController();
  const timer = setInterval(async () => {
    try {
      const cancel = await readImmutableWorkerJson<ReleaseBuildWorkerCancellation>(
        join(input.inputDirectory, "cancel.json"),
      );
      const secret = await readReleaseBuildWorkerSecret(input.secretFile);
      if (verifyWorkerCancellation(cancel, secret) &&
        sameWorkerIdentity(cancel.identity, input.request.identity)) {
        controller.abort(cancel.reason);
      }
    } catch { /* authenticated cancellation is optional until published */ }
  }, 200);
  timer.unref();
  return { signal: controller.signal, stop: () => clearInterval(timer) };
}
