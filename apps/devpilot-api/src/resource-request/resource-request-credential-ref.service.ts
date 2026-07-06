/**
 * Provisioning credential-ref resolver.
 *
 * Resolves a redacted TeamCredential reference for external provisioning
 * adapters (script / http / provider) without decrypting the secret. Extracted
 * into its own service so the provisioning orchestrator and the individual
 * adapters can share it without creating a circular dependency (orchestrator
 * ↔ adapters). Behavior preserved verbatim from the original
 * `ResourceRequestService.resolveProvisioningCredentialRef`.
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ResourceRequestRepository } from './resource-request.repository';
import { ProvisioningCredentialRef, JsonRecord } from './resource-request.types';
import {
  asRecord,
  readBoolean,
  readString,
} from './resource-provisioning-value.utils';
import {
  resolveAuthAdapterKey,
  readCredentialTypeAllowList,
} from './resource-provisioning-http-config.utils';

@Injectable()
export class ResourceRequestCredentialRefService {
  constructor(private readonly repo: ResourceRequestRepository) {}

  async resolveProvisioningCredentialRef(
    teamId: string,
    config: JsonRecord,
  ): Promise<ProvisioningCredentialRef | null> {
    const auth = asRecord(config.auth);
    const credential = asRecord(config.credential);
    const credentialId = (
      readString(config.credentialId)
      || readString(auth.credentialId)
      || readString(credential.id)
    );
    const credentialRequired = readBoolean(config.requireCredential, readBoolean(auth.required, false));

    if (!credentialId) {
      if (credentialRequired) {
        throw new BadRequestException('外部资源交付需要绑定 TeamCredential');
      }
      return null;
    }

    const record = await this.repo.findTeamCredential({
      where: { id: credentialId, teamId },
      select: { id: true, name: true, type: true },
    });

    if (!record) {
      throw new NotFoundException('TeamCredential 不存在或不属于当前团队');
    }

    const allowedTypes = readCredentialTypeAllowList(config, auth);
    if (allowedTypes.length > 0 && !allowedTypes.includes(record.type)) {
      throw new BadRequestException('TeamCredential 类型与外部资源交付 adapter 不匹配');
    }

    return {
      source: 'team_credential',
      referenceId: record.id,
      displayName: record.name,
      credentialType: record.type,
      authAdapterKey: resolveAuthAdapterKey(record.type, auth),
      redacted: true,
    };
  }
}
