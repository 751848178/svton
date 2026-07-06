import { createTestCryptoService } from "../common/crypto/crypto.test-helpers";
import { PoolType } from "./dto/resource-pool.dto";
import { ResourcePoolRepository } from "./resource-pool.repository";
import { ResourcePoolService } from "./resource-pool.service";

const poolCrypto = createTestCryptoService("default-key-32-chars-long!!!!!");
const allocationLifecycleService = {
  allocateResource: jest.fn(),
  releaseResource: jest.fn(),
};

function createService(repository: unknown) {
  return new ResourcePoolService(
    repository as ResourcePoolRepository,
    poolCrypto as never,
    allocationLifecycleService as never,
  );
}

describe("ResourcePoolService read scoping", () => {
  it("loads user allocations within the current team only", async () => {
    const repository = {
      findUserAllocations: jest.fn().mockResolvedValue([
        {
          id: "allocation-1",
          pool: { type: "mysql", name: "MySQL Pool" },
          resourceName: "db_project",
          project: { name: "Project A" },
          status: "active",
          createdAt: new Date("2026-07-02T00:00:00.000Z"),
          releasedAt: null,
        },
      ]),
    };
    const service = createService(repository);

    await expect(
      service.getUserAllocations("team-1", "user-1"),
    ).resolves.toHaveLength(1);
    expect(repository.findUserAllocations).toHaveBeenCalledWith(
      "team-1",
      "user-1",
    );
  });

  it("encrypts adminConfig on the main resource-pool create path", async () => {
    const repository = {
      createPool: jest.fn((data) =>
        Promise.resolve({
          id: "pool-1",
          allocated: 0,
          createdAt: new Date("2026-07-02T00:00:00.000Z"),
          updatedAt: new Date("2026-07-02T00:00:00.000Z"),
          ...data,
        }),
      ),
    };
    const service = createService(repository);

    await service.createPool({
      type: PoolType.MYSQL,
      name: "MySQL Pool",
      endpoint: "mysql.internal:3306",
      adminConfig: { username: "root", password: "secret" },
      capacity: 10,
    });
    const createData = repository.createPool.mock.calls[0][0];

    expect(createData.adminConfig).not.toContain("secret");
    expect(JSON.parse(poolCrypto.decryptCbc(createData.adminConfig))).toEqual({
      username: "root",
      password: "secret",
    });
  });
});
