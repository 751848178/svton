/**
 * Resource-type CRUD + default seed service.
 *
 * Owns the resource-type management surface (create / list / get / update /
 * disable) and the on-boot seed of `DEFAULT_RESOURCE_TYPES`. Extracted from
 * `ResourceRequestService` so the facade stops carrying CRUD and seed logic.
 * Behavior preserved verbatim — identical repository calls, errors, and audit
 * log messages.
 */

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { DEFAULT_RESOURCE_TYPES } from './resource-type-defaults.constants';
import {
  CreateResourceTypeDto,
  UpdateResourceTypeDto,
} from './dto/resource-request.dto';

@Injectable()
export class ResourceTypeService {
  private readonly logger = new Logger(ResourceTypeService.name);

  constructor(private readonly repo: ResourceRequestRepository) {}

  async ensureDefaults() {
    for (const type of DEFAULT_RESOURCE_TYPES) {
      await this.repo.upsertResourceType({
        where: { key: type.key },
        create: {
          key: type.key,
          name: type.name,
          description: type.description,
          category: type.category,
          icon: type.icon,
          enabled: type.enabled ?? true,
          requestSchema: type.requestSchema,
          deliverySchema: type.deliverySchema,
          envTemplate: type.envTemplate,
          approvalMode: type.approvalMode ?? 'manual',
          provisioningMode: type.provisioningMode ?? 'manual',
          provisioningConfig: type.provisioningConfig,
        },
        update: {
          name: type.name,
          description: type.description,
          category: type.category,
          icon: type.icon,
          requestSchema: type.requestSchema,
          deliverySchema: type.deliverySchema,
          envTemplate: type.envTemplate,
          approvalMode: type.approvalMode ?? 'manual',
          provisioningMode: type.provisioningMode ?? 'manual',
          provisioningConfig: type.provisioningConfig,
        },
      });
    }
  }

  async createResourceType(userId: string, dto: CreateResourceTypeDto) {
    const existing = await this.repo.findResourceTypeByUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException('资源类型 key 已存在');
    }

    const resourceType = await this.repo.createResourceType({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        icon: dto.icon,
        enabled: dto.enabled ?? true,
        requestSchema: dto.requestSchema,
        deliverySchema: dto.deliverySchema,
        envTemplate: dto.envTemplate,
        approvalMode: dto.approvalMode ?? 'manual',
        provisioningMode: dto.provisioningMode ?? 'manual',
        provisioningConfig: dto.provisioningConfig,
        createdById: userId,
      },
    });

    this.logger.log(`Resource type created: ${resourceType.key}`);
    return resourceType;
  }

  async listResourceTypes(includeDisabled = false) {
    return this.repo.findResourceTypes({
      where: includeDisabled ? undefined : { enabled: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getResourceType(id: string) {
    const resourceType = await this.repo.findResourceTypeByUnique({
      where: { id },
    });

    if (!resourceType) {
      throw new NotFoundException('资源类型不存在');
    }

    return resourceType;
  }

  async updateResourceType(id: string, dto: UpdateResourceTypeDto) {
    await this.getResourceType(id);

    return this.repo.updateResourceType({
      where: { id },
      data: dto,
    });
  }

  async disableResourceType(id: string) {
    await this.getResourceType(id);

    return this.repo.updateResourceType({
      where: { id },
      data: { enabled: false },
    });
  }
}
