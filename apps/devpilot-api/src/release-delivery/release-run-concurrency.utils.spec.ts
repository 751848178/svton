import { ACTIVE_RELEASE_RUN_STATUSES } from "./release-run-concurrency.utils";

describe("Production active release states", () => {
  it("keeps awaiting validation active so a second Production cannot start", () => {
    expect(ACTIVE_RELEASE_RUN_STATUSES).toEqual([
      "awaiting_approval",
      "running",
      "awaiting_validation",
    ]);
  });
});
