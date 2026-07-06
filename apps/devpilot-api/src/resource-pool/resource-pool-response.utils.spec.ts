import {
  formatPoolAllocationSummary,
  formatPoolResponse,
  formatProjectAllocation,
  formatUserAllocation,
} from "./resource-pool-response.utils";
import {
  ResourceAllocationRecord,
  ResourcePoolRecord,
} from "./resource-pool.types";

const createdAt = new Date("2026-07-04T00:00:00.000Z");
const updatedAt = new Date("2026-07-04T01:00:00.000Z");

describe("resource-pool response utils", () => {
  it("formats pool capacity and availability", () => {
    expect(formatPoolResponse(poolRecord())).toEqual({
      id: "pool-1",
      type: "mysql",
      name: "MySQL Pool",
      endpoint: "mysql.internal:3306",
      capacity: 10,
      allocated: 3,
      available: 7,
      status: "active",
      createdAt,
      updatedAt,
    });
  });

  it("formats pool detail and allocation list rows", () => {
    const allocation = allocationRecord();

    expect(formatPoolAllocationSummary(allocation)).toEqual({
      id: "allocation-1",
      resourceName: "db_project",
      projectName: "Project A",
      userName: "Ada",
      createdAt,
    });
    expect(formatProjectAllocation(allocation)).toEqual({
      id: "allocation-1",
      poolType: "mysql",
      poolName: "MySQL Pool",
      resourceName: "db_project",
      createdAt,
    });
    expect(formatUserAllocation(allocation)).toEqual({
      id: "allocation-1",
      poolType: "mysql",
      poolName: "MySQL Pool",
      resourceName: "db_project",
      projectName: "Project A",
      status: "active",
      createdAt,
      releasedAt: null,
    });
  });
});

function poolRecord(): ResourcePoolRecord {
  return {
    id: "pool-1",
    type: "mysql",
    name: "MySQL Pool",
    endpoint: "mysql.internal:3306",
    adminConfig: "encrypted",
    capacity: 10,
    allocated: 3,
    status: "active",
    createdAt,
    updatedAt,
  };
}

function allocationRecord(): ResourceAllocationRecord {
  return {
    id: "allocation-1",
    poolId: "pool-1",
    projectId: "project-1",
    teamId: "team-1",
    userId: "user-1",
    resourceName: "db_project",
    credentials: "encrypted",
    config: {},
    status: "active",
    createdAt,
    releasedAt: null,
    pool: poolRecord(),
    project: { name: "Project A" },
    user: { name: "Ada", email: "ada@example.com" },
  };
}
