import type { ReleaseBuildFailure } from "./release-build.types";

export class ReleaseBuildExecutionError extends Error {
  constructor(readonly detail: ReleaseBuildFailure) {
    super(detail.message);
    this.name = "ReleaseBuildExecutionError";
  }
}
