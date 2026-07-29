import { CommandRule } from "./server-command-policy.types";

export const DEPLOYMENT_COMMAND_RULES: CommandRule[] = [
  {
    key: "curl-health-check",
    description: "HTTP health check",
    adapters: ["application-service-runtime-plan", "deployment-script-plan"],
    operations: [
      "application-service.status",
      "application-service.restart",
      "application-service.rollback",
      "deployment.run",
      "deployment.rollback",
      "deployment.smoke_check",
    ],
    pattern: /^curl -fsS (?:'https?:\/\/[^']+'|https?:\/\/\S+)$/,
  },
  {
    key: "git-deployment-checkout",
    description: "Deployment git checkout",
    adapters: ["deployment-script-plan"],
    pattern:
      /^git fetch --all --prune && git checkout [a-zA-Z0-9._/@-]+ && git pull$/,
  },
  {
    key: "git-deployment-rollback-checkout",
    description: "Deployment rollback checkout by commit sha",
    adapters: ["deployment-script-plan"],
    pattern: /^git fetch --all --prune && git checkout [a-fA-F0-9]{7,64}$/,
  },
  {
    key: "node-build",
    description: "Common Node.js build commands",
    adapters: ["deployment-script-plan"],
    pattern:
      /^(pnpm|npm|yarn|bun)(?: [a-zA-Z0-9_./:@=-]+)* (build|run build|install|ci)(?: [a-zA-Z0-9_./:@=-]+)*$/,
  },
  {
    key: "docker-build",
    description: "Docker build commands",
    adapters: ["deployment-script-plan"],
    pattern: /^docker (?:build|compose build)(?: [a-zA-Z0-9_./:@=+-]+)*$/,
  },
  {
    key: "docker-compose-deploy",
    description: "Docker Compose deployment commands",
    adapters: ["deployment-script-plan"],
    pattern:
      /^docker compose (?:pull|up -d(?: --build)?|restart)(?: [a-zA-Z0-9_./:@=+-]+)*$/,
  },
  {
    key: "write-env-file",
    description:
      "Write .env file (redacted form persisted; real heredoc re-rendered at the queue execution boundary from step.secretEnv)",
    adapters: ["deployment-script-plan"],
    operations: ["deployment.run", "deployment.rollback"],
    // Matches BOTH forms:
    //  - persisted/redacted: fixed delimiter DEVPLOT_ENV_EOF + ***REDACTED*** values
    //  - execution-boundary real form: randomized delimiter DEVPLOT_ENV_EOF_<hex>
    //    + real values (re-applied by reapplyDeploymentEnvWriteSecrets just before SSH live).
    // Values are non-user-supplied (resolved platform secrets), so allowing any value here
    // does not weaken command injection protection; the heredoc structure is the invariant.
    pattern:
      /^cat > \.env <<'DEVPLOT_ENV_EOF(?:_[0-9a-f]+)?'\n(?:[A-Z_][A-Z0-9_]*=[^\n]*\n)+DEVPLOT_ENV_EOF(?:_[0-9a-f]+)?$/,
  },
  {
    key: "remove-env-file",
    description: "Remove .env file after deployment (best-effort cleanup)",
    adapters: ["deployment-script-plan"],
    operations: ["deployment.run", "deployment.rollback"],
    pattern: /^rm -f \.env$/,
  },
];
