import { validate } from "class-validator";
import { CreateReleaseOrderDto } from "./release-order.dto";

describe("CreateReleaseOrderDto", () => {
  it("accepts a named canonical x.y.z release", async () => {
    const dto = Object.assign(new CreateReleaseOrderDto(), {
      releaseName: "Stable release",
      releaseVersion: "1.4.0",
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(["v1.4.0", "1.4", "1.4.0-rc.1", "01.4.0"])(
    "rejects non-canonical version %s",
    async (releaseVersion) => {
      const dto = Object.assign(new CreateReleaseOrderDto(), {
        releaseName: "Stable release",
        releaseVersion,
      });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === "releaseVersion")).toBe(
        true,
      );
    },
  );

  it("requires a release name", async () => {
    const dto = Object.assign(new CreateReleaseOrderDto(), {
      releaseVersion: "1.4.0",
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === "releaseName")).toBe(true);
  });
});
