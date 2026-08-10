import type { ProjectDirectoryRecord } from "./project-directory.repository";
import type {
  ProjectDirectoryActivity,
  ProjectDirectoryActivityType,
} from "./project-directory.types";

const ACTIVITY_TYPES = new Set<ProjectDirectoryActivityType>([
  "analysis",
  "deployment",
  "release",
  "audit",
  "intake",
  "project",
]);

export function projectDirectoryActivity(
  project: ProjectDirectoryRecord,
): ProjectDirectoryActivity {
  const activity = project.recentActivity;
  return {
    id: activity.id,
    type: ACTIVITY_TYPES.has(
      activity.activityType as ProjectDirectoryActivityType,
    )
      ? (activity.activityType as ProjectDirectoryActivityType)
      : "project",
    status: activity.status,
    summary: activity.summary,
    occurredAt: activity.occurredAt.toISOString(),
  };
}
