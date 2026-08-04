import { ValidationPipe } from "@nestjs/common";
import { ReleaseOrderListQueryDto } from "./release-order-list-query.dto";

describe("ReleaseOrderListQueryDto", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const metadata = {
    type: "query" as const,
    metatype: ReleaseOrderListQueryDto,
  };

  it("defaults take and accepts every persisted status", async () => {
    for (const status of [
      "draft",
      "active",
      "succeeded",
      "failed",
      "canceled",
    ]) {
      await expect(pipe.transform({ status }, metadata)).resolves.toMatchObject(
        {
          status,
          take: 50,
        },
      );
    }
  });

  it.each([
    [{ status: "building" }],
    [{ take: 0 }],
    [{ take: 101 }],
    [{ take: "2.5" }],
    [{ query: "q".repeat(201) }],
    [{ teamId: "forged" }],
  ])("rejects invalid or unscoped query input %#", async (value) => {
    await expect(pipe.transform(value, metadata)).rejects.toMatchObject({
      status: 400,
    });
  });
});
