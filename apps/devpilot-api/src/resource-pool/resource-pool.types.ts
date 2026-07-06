export type ResourcePoolRecord = {
  id: string;
  type: string;
  name: string;
  endpoint: string;
  adminConfig: string;
  capacity: number;
  allocated: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ResourceAllocationRecord = {
  id: string;
  poolId: string;
  projectId: string;
  teamId: string;
  userId: string;
  resourceName: string;
  credentials: string;
  config: unknown;
  status: string;
  createdAt: Date;
  releasedAt: Date | null;
  pool?: ResourcePoolRecord;
  project?: { name: string };
  user?: { name: string | null; email: string };
};
