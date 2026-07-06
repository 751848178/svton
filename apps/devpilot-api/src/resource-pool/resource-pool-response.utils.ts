import {
  ResourceAllocationRecord,
  ResourcePoolRecord,
} from "./resource-pool.types";

export function formatPoolResponse(
  pool: Pick<
    ResourcePoolRecord,
    | "id"
    | "type"
    | "name"
    | "endpoint"
    | "capacity"
    | "allocated"
    | "status"
    | "createdAt"
    | "updatedAt"
  >,
) {
  return {
    id: pool.id,
    type: pool.type,
    name: pool.name,
    endpoint: pool.endpoint,
    capacity: pool.capacity,
    allocated: pool.allocated,
    status: pool.status,
    available: pool.capacity - pool.allocated,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
  };
}

export function formatPoolAllocationSummary(
  allocation: ResourceAllocationRecord,
) {
  return {
    id: allocation.id,
    resourceName: allocation.resourceName,
    projectName: allocation.project?.name,
    userName: allocation.user?.name || allocation.user?.email,
    createdAt: allocation.createdAt,
  };
}

export function formatProjectAllocation(allocation: ResourceAllocationRecord) {
  return {
    id: allocation.id,
    poolType: allocation.pool?.type,
    poolName: allocation.pool?.name,
    resourceName: allocation.resourceName,
    createdAt: allocation.createdAt,
  };
}

export function formatUserAllocation(allocation: ResourceAllocationRecord) {
  return {
    id: allocation.id,
    poolType: allocation.pool?.type,
    poolName: allocation.pool?.name,
    resourceName: allocation.resourceName,
    projectName: allocation.project?.name,
    status: allocation.status,
    createdAt: allocation.createdAt,
    releasedAt: allocation.releasedAt,
  };
}
