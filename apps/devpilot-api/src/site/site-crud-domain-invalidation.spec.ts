import { Prisma } from "@prisma/client";
import { SiteCrudService } from "./site-crud.service";

describe("SiteCrudService domain evidence invalidation", () => {
  it("clears server probe evidence when the primary domain changes", async () => {
    const prisma = fixture();
    await new SiteCrudService(prisma as never).updateSite(
      "team-1", "site-1", { primaryDomain: "new.example" },
    );
    expect(prisma.site.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        primaryDomain: "new.example", dns: Prisma.DbNull, tls: Prisma.DbNull,
        lastSyncAt: null, status: "pending",
      }),
    }));
  });

  it("preserves probe evidence for a name-only update", async () => {
    const prisma = fixture();
    await new SiteCrudService(prisma as never).updateSite(
      "team-1", "site-1", { name: "renamed" },
    );
    expect(prisma.site.update.mock.calls[0][0].data).not.toHaveProperty("dns");
    expect(prisma.site.update.mock.calls[0][0].data).not.toHaveProperty("tls");
  });
});

function fixture() {
  return { site: {
    findFirst: jest.fn().mockResolvedValue({
      id: "site-1", teamId: "team-1", projectId: null,
      primaryDomain: "old.example", aliases: ["www.old.example"],
    }),
    update: jest.fn().mockResolvedValue({ id: "site-1" }),
  } };
}
