import { z } from "zod";
import { positiveInt } from "./env-schema-primitives";

export const siteRouteSwitchEnvSchema = z.object({
  SITE_ROUTE_SWITCH_PROVIDER_PROFILE: z
    .enum(["disabled", "http-route-control-v1"])
    .default("disabled"),
  SITE_ROUTE_SWITCH_HTTP_ENDPOINT: z.string().url().optional(),
  SITE_ROUTE_SWITCH_HTTP_TOKEN: z.string().min(32).optional(),
  SITE_ROUTE_SWITCH_HTTP_TIMEOUT_MS: positiveInt(1).default(5000),
});
