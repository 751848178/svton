import { CONTAINER_COMMAND_RULES } from "./server-command-policy-container-rules.constants";
import { DEPLOYMENT_COMMAND_RULES } from "./server-command-policy-deployment-rules.constants";
import { OPENRESTY_COMMAND_RULES } from "./server-command-policy-openresty-rules.constants";
import { SITE_COMMAND_RULES } from "./server-command-policy-site-rules.constants";
import { CommandRule } from "./server-command-policy.types";

export const BUILT_IN_COMMAND_RULES: CommandRule[] = [
  ...CONTAINER_COMMAND_RULES,
  ...DEPLOYMENT_COMMAND_RULES,
  ...SITE_COMMAND_RULES,
  ...OPENRESTY_COMMAND_RULES,
];
