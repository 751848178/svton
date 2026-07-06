/**
 * Pool provisioning adapter.
 *
 * Allocates a resource from a configured `ResourcePool`, splits the allocation
 * credentials into delivery / credentials, and completes the provisioned
 * request with an encrypted instance. Extracted verbatim from the original
 * `provisionFromPool` in `ResourceRequestService`. No behavior change.
 */

import { Injectable } from '@nestjs/common';
import { ResourceRequestStatusWriterService } from './resource-request-status-writer.service';
import { ResourcePoolService } from '../resource-pool/resource-pool.service';
import {
  JsonRecord,
  ProvisioningResourceType,
} from './resource-request.types';
import {
  asRecord,
  errorMessage,
  readString,
} from './resource-provisioning-value.utils';
import {
  resolveRequestedResourceName,
  splitDeliveryAndCredentials,
} from './resource-provisioning-sensitive.utils';

@Injectable()
export class ResourceRequestPoolProvisioningService {
  constructor(
    private readonly statusWriter: ResourceRequestStatusWriterService,
    private readonly resourcePoolService: ResourcePoolService,
  ) {}

  async provisionFromPool(
    teamId: string,
    userId: string,
    request: JsonRecord,
    resourceType: ProvisioningResourceType,
  ) {
    const provisioningConfig = asRecord(resourceType.provisioningConfig);
    const poolId = readString(provisioningConfig.poolId);

    if (!poolId) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        reason: 'missing_pool_id',
        blockedAt: new Date().toISOString(),
      });
    }

    const projectId = readString(request.projectId);
    if (!projectId) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        poolId,
        reason: 'missing_project_id',
        blockedAt: new Date().toISOString(),
      });
    }

    let allocation: { id: string; type?: string; resourceName: string; credentials?: unknown };
    try {
      allocation = await this.resourcePoolService.allocateResource(
        { poolId, projectId, resourceName: resolveRequestedResourceName(request.spec) },
        userId,
        teamId,
      );
    } catch (error) {
      return this.statusWriter.markProvisioningStatus(teamId, userId, request, {
        mode: 'pool',
        status: 'blocked',
        boundary: 'resource_pool',
        poolId,
        reason: errorMessage(error),
        blockedAt: new Date().toISOString(),
      });
    }

    const split = splitDeliveryAndCredentials(allocation.credentials, resourceType.deliverySchema);
    const completedAt = new Date().toISOString();
    const completion = await this.statusWriter.completeProvisionedRequest(teamId, userId, request, {
      createInstance: true,
      instanceName: allocation.resourceName || (request.title as string),
      config: {
        provisioningMode: 'pool',
        poolId,
        poolAllocationId: allocation.id,
        poolType: allocation.type || resourceType.key,
        resourceName: allocation.resourceName,
      },
      delivery: {
        ...split.delivery,
        poolAllocationId: allocation.id,
        poolType: allocation.type || resourceType.key,
        resourceName: allocation.resourceName,
      },
      credentials: split.credentials,
      provisioning: {
        mode: 'pool',
        status: 'completed',
        boundary: 'resource_pool',
        poolId,
        allocationId: allocation.id,
        resourceName: allocation.resourceName,
        poolType: allocation.type || resourceType.key,
        completedAt,
      },
      auditMetadata: {
        createInstance: true,
        provisioningMode: 'pool',
        boundary: 'resource_pool',
        poolId,
        allocationId: allocation.id,
        resourceName: allocation.resourceName,
      },
    });

    return completion.request;
  }
}
