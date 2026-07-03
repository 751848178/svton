import { Prisma } from "@prisma/client";
import type { alertEventInclude } from "./monitoring-alert-event.constants";

export type AlertEventRecord = Prisma.AlertEventGetPayload<{
  include: typeof alertEventInclude;
}>;
