/**
 * Resource-request status / audit / credential-encryption write core.
 *
 * Owns the shared write helpers every provisioning adapter and recovery flow
 * depend on: writing audit logs, updating `request.result.provisioning` with
 * the matching audit action, completing a provisioned request (creating the
 * instance with encrypted credentials), and AES-256-GCM credential
 * encrypt/decrypt. Extracted from `ResourceRequestService` so the god service
 * and future focused services share one write core. Behavior preserved
 * verbatim — identical repository calls, audit actions, and crypto.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ResourceRequestRepository } from './resource-request.repository';
import {
  resourceInstanceInclude,
  resourceRequestInclude,
} from './resource-request-includes.constants';
import {
  AuditInput,
  CompleteProvisionedRequestInput,
  JsonRecord,
} from './resource-request.types';
import {
  provisioningAuditAction,
  provisioningAuditMessage,
} from './resource-provisioning-script.utils';
import {
  asRecord,
  hasRecordValues,
  readString,
} from './resource-provisioning-value.utils';
import {
  decryptCredential,
  encryptCredential,
} from './resource-credential-crypto.utils';

@Injectable()
export class ResourceRequestStatusWriterService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly repo: ResourceRequestRepository,
    configService: ConfigService,
  ) {
    const key = configService.get('ENCRYPTION_KEY', 'default-32-char-encryption-key!');
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  encrypt(text: string): string {
    return encryptCredential(text, this.encryptionKey);
  }

  decrypt(encryptedText: string): string {
    return decryptCredential(encryptedText, this.encryptionKey);
  }

  requestInclude() {
    return resourceRequestInclude;
  }

  instanceInclude() {
    return resourceInstanceInclude;
  }

  maskInstance(instance: Record<string, unknown>) {
    const { credentials, ...safe } = instance;
    return {
      ...safe,
      hasCredentials: Boolean(credentials),
    };
  }

  writeAudit(input: AuditInput) {
    return this.repo.createResourceAuditLog({
      data: {
        teamId: input.teamId,
        actorId: input.actorId,
        resourceTypeId: input.resourceTypeId,
        requestId: input.requestId,
        instanceId: input.instanceId,
        provisioningRunId: input.provisioningRunId,
        action: input.action,
        message: input.message,
        metadata: input.metadata ?? {},
      },
    });
  }

  async markProvisioningStatus(
    teamId: string,
    userId: string | undefined,
    request: JsonRecord,
    provisioning: JsonRecord,
  ) {
    const nextResult = {
      ...asRecord(request.result),
      provisioning,
    };
    const updated = await this.repo.updateRequest({
      where: { id: request.id },
      data: { result: nextResult },
      include: this.requestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: request.resourceTypeId as string,
      requestId: request.id as string,
      provisioningRunId: readString(provisioning.provisioningRunId) || undefined,
      action: provisioningAuditAction(provisioning.status),
      message: provisioningAuditMessage(provisioning.status),
      metadata: provisioning,
    });

    return updated;
  }

  async completeProvisionedRequest(
    teamId: string,
    userId: string | undefined,
    existing: JsonRecord,
    input: CompleteProvisionedRequestInput,
  ) {
    let instance: JsonRecord | null = null;

    if (input.createInstance) {
      instance = await this.repo.createInstance({
        data: {
          teamId,
          projectId: existing.projectId,
          environmentId: existing.environmentId,
          requestId: existing.id,
          resourceTypeId: existing.resourceTypeId,
          name: input.instanceName,
          status: 'active',
          config: input.config,
          delivery: input.delivery,
          credentials: hasRecordValues(input.credentials)
            ? this.encrypt(JSON.stringify(input.credentials))
            : undefined,
          expiresAt: input.expiresAt,
        },
        include: this.instanceInclude(),
      });
    }

    const completedAt = new Date();
    const request = await this.repo.updateRequest({
      where: { id: existing.id },
      data: {
        status: 'completed',
        completedAt,
        result: {
          ...asRecord(existing.result),
          provisioning: input.provisioning,
          delivery: input.delivery,
          instanceId: instance?.id,
        },
      },
      include: this.requestInclude(),
    });

    await this.writeAudit({
      teamId,
      actorId: userId,
      resourceTypeId: existing.resourceTypeId as string,
      requestId: existing.id as string,
      instanceId: instance?.id as string | undefined,
      provisioningRunId: readString(input.provisioning.provisioningRunId) || undefined,
      action: 'request.completed',
      message: '资源申请已交付',
      metadata: input.auditMetadata ?? { createInstance: input.createInstance },
    });

    return {
      request,
      instance: instance ? this.maskInstance(instance) : null,
    };
  }
}
