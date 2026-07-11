import { forwardRef, Module } from "@nestjs/common";
import { AuditEventModule } from "../audit-event";
import { PrismaModule } from "../prisma/prisma.module";
import { ControlAccessPolicyController } from "./control-access-policy.controller";
import { ControlAccessPolicyAccessService } from "./control-access-policy-access.service";
import { ControlAccessPolicyAuditService } from "./control-access-policy-audit.service";
import { ControlAccessPolicyRepository } from "./control-access-policy.repository";
import { ControlAccessPolicyCrudService } from "./control-access-policy-crud.service";
import { ControlAccessPolicyService } from "./control-access-policy.service";

@Module({
  imports: [PrismaModule, forwardRef(() => AuditEventModule)],
  controllers: [ControlAccessPolicyController],
  providers: [
    ControlAccessPolicyService,
    ControlAccessPolicyRepository,
    ControlAccessPolicyAuditService,
    ControlAccessPolicyAccessService,
    ControlAccessPolicyCrudService,
  ],
  exports: [ControlAccessPolicyService],
})
export class ControlAccessPolicyModule {}
