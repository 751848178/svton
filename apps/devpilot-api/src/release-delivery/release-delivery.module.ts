import { Module } from "@nestjs/common";
import { ControlAccessPolicyModule } from "../control-access-policy";
import { PrismaModule } from "../prisma/prisma.module";
import { ReleaseOrderAccessService } from "./release-order-access.service";
import { ReleaseOrderController } from "./release-order.controller";
import { ReleaseOrderRepository } from "./release-order.repository";
import { ReleaseOrderService } from "./release-order.service";

@Module({
  imports: [PrismaModule, ControlAccessPolicyModule],
  controllers: [ReleaseOrderController],
  providers: [
    ReleaseOrderService,
    ReleaseOrderRepository,
    ReleaseOrderAccessService,
  ],
  exports: [ReleaseOrderService],
})
export class ReleaseDeliveryModule {}
