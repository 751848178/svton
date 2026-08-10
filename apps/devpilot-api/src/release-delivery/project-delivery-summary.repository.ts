import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PROJECT_DELIVERY_SUMMARY_SELECT } from "./project-delivery-summary.select";

@Injectable()
export class ProjectDeliverySummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  load(teamId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, teamId, archivedAt: null },
      select: PROJECT_DELIVERY_SUMMARY_SELECT,
    });
  }
}
