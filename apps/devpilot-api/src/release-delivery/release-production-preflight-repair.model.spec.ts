import { productionGateRepairHref } from "./release-production-preflight-repair.model";

describe("Production preflight repair href", () => {
  it("opens the exact environment and service deployment editor for D05/D17", () => {
    for (const gateId of ["D05", "D17"]) {
      expect(productionGateRepairHref({
        projectId: "project-1",
        environmentId: "environment-id-1",
        environmentKey: "production-key",
        serviceId: "service-api",
        gateId,
      })).toBe(
        "/applications?projectId=project-1&environmentId=environment-id-1" +
        "&serviceId=service-api&action=edit-deployment",
      );
    }
  });

  it("keeps D13 as an approval next step without a repair link", () => {
    expect(productionGateRepairHref({
      projectId: "project-1",
      environmentId: "environment-id-1",
      environmentKey: "production-key",
      gateId: "D13",
    })).toBeUndefined();
  });

  it("uses environment key for settings routes and never substitutes the id", () => {
    expect(productionGateRepairHref({
      projectId: "project-1", environmentId: "environment-id-1",
      environmentKey: "production-key", gateId: "D14",
    })).toContain("env=production-key&envTab=routes");
  });
});
