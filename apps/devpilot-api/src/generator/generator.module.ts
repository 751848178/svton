import { Module } from '@nestjs/common';
import { GeneratorService } from './generator.service';
import { GeneratorController } from './generator.controller';
import { RegistryModule } from '../registry/registry.module';
import { ProjectModule } from '../project/project.module';
import { ResourceModule } from '../resource/resource.module';
import { ResourcePoolModule } from '../resource-pool/resource-pool.module';
import { ResourceRequestModule } from '../resource-request/resource-request.module';
import { ControlAccessPolicyModule } from '../control-access-policy';
import { AuditEventModule } from '../audit-event';
import { GeneratedProjectArtifactCleanupSchedulerService } from './generated-project-artifact-cleanup-scheduler.service';

@Module({
  imports: [
    RegistryModule,
    ProjectModule,
    ResourceModule,
    ResourcePoolModule,
    ResourceRequestModule,
    ControlAccessPolicyModule,
    AuditEventModule,
  ],
  controllers: [GeneratorController],
  providers: [GeneratorService, GeneratedProjectArtifactCleanupSchedulerService],
  exports: [GeneratorService],
})
export class GeneratorModule {}
