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
];
