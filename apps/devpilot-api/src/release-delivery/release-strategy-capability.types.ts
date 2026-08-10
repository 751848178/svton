export const RELEASE_STRATEGIES = [
  "standard",
  "canary",
  "blue_green",
  "automatic_traffic",
] as const;

export type ReleaseStrategy = (typeof RELEASE_STRATEGIES)[number];

export interface ReleaseStrategyCapability {
  strategy: ReleaseStrategy;
  executable: boolean;
  reasonCode: string;
  reason: { zh: string; en: string };
  missingCapabilities: string[];
}
