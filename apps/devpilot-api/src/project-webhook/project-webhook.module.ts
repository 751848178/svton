import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DeploymentModule } from '../deployment/deployment.module';
import { ControlAccessPolicyModule } from '../control-access-policy';
import {
  ProjectWebhookController,
  PublicGitWebhookController,
} from './project-webhook.controller';
import { ProjectWebhookService } from './project-webhook.service';

@Module({
  imports: [PrismaModule, DeploymentModule, ControlAccessPolicyModule],
  controllers: [ProjectWebhookController, PublicGitWebhookController],
  providers: [ProjectWebhookService],
  exports: [ProjectWebhookService],
})
export class ProjectWebhookModule {}
