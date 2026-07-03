import { Prisma } from "@prisma/client";
import type { alertSilenceSelect } from "./monitoring-alert-silence.constants";

export type AlertSilenceRecord = Prisma.AlertSilenceGetPayload<{
  select: typeof alertSilenceSelect;
}>;

export type AlertSilenceRuleTarget = {
  projectId?: string | null;
  environmentId?: string | null;
  category: string;
  metric: string;
  severity: string;
};
