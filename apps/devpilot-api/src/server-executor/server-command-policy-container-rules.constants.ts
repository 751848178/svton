import { CommandRule } from "./server-command-policy.types";

export const CONTAINER_COMMAND_RULES: CommandRule[] = [
  {
    key: "docker-inspect",
    description: "Docker inspect",
    adapters: ["server-resource-script-plan", "resource-connection-plan"],
    pattern: /^docker inspect [a-zA-Z0-9_.:/@-]+$/,
  },
  {
    key: "docker-logs",
    description: "Docker logs tail",
    adapters: [
      "server-resource-script-plan",
      "application-service-runtime-plan",
      "log-collection-plan",
    ],
    pattern: /^docker logs --tail=\d{1,5} [a-zA-Z0-9_.:/@-]+$/,
  },
  {
    key: "docker-stats-json-snapshot",
    description: "Docker stats single JSON snapshot",
    adapters: ["server-resource-script-plan"],
    pattern:
      /^docker stats --no-stream --format '\{\{json \.\}\}' [a-zA-Z0-9_.:/@-]+$/,
  },
  {
    key: "docker-restart",
    description: "Docker restart",
    adapters: [
      "server-resource-script-plan",
      "application-service-runtime-plan",
    ],
    pattern: /^docker restart [a-zA-Z0-9_.:/@-]+$/,
  },
  {
    key: "docker-ps",
    description: "Docker ps status",
    adapters: ["application-service-runtime-plan"],
    pattern:
      /^docker ps --filter name=(?:'[^']+'|[a-zA-Z0-9_.:/@-]+) --format "table \{\{\.Names\}\}\\t\{\{\.Image\}\}\\t\{\{\.Status\}\}\\t\{\{\.Ports\}\}"$/,
  },
  {
    key: "docker-ps-json-inventory",
    description: "Docker inventory as JSON lines",
    adapters: ["docker-inventory-plan"],
    pattern: /^docker ps -a --no-trunc --format '\{\{json \.\}\}'$/,
  },
  {
    key: "docker-exec-mysqladmin",
    description: "MySQL ping inside Docker",
    adapters: ["server-resource-script-plan", "resource-connection-plan"],
    pattern:
      /^docker exec [a-zA-Z0-9_.:/@-]+ mysqladmin ping -h 127\.0\.0\.1 -P \d{1,5}$/,
  },
  {
    key: "docker-exec-mysqldump",
    description: "MySQL dump inside Docker",
    adapters: ["server-resource-script-plan", "backup-script-plan"],
    pattern:
      /^docker exec [a-zA-Z0-9_.:/@-]+ sh -lc 'mysqldump --single-transaction --all-databases > \/tmp\/devpilot-backup\.sql'$/,
  },
  {
    key: "docker-cp-mysql-backup",
    description: "Copy MySQL backup out of Docker",
    adapters: ["server-resource-script-plan", "backup-script-plan"],
    pattern:
      /^docker cp [a-zA-Z0-9_.:/@-]+:\/tmp\/devpilot-backup\.sql \/var\/backups\/devpilot\/mysql\/devpilot-backup\.sql$/,
  },
  {
    key: "docker-exec-redis-bgsave",
    description: "Redis BGSAVE inside Docker",
    adapters: ["backup-script-plan"],
    pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ redis-cli BGSAVE$/,
  },
  {
    key: "docker-cp-redis-backup",
    description: "Copy Redis backup out of Docker",
    adapters: ["backup-script-plan"],
    pattern:
      /^docker cp [a-zA-Z0-9_.:/@-]+:\/data\/dump\.rdb \/var\/backups\/devpilot\/redis\/dump\.rdb$/,
  },
  {
    key: "docker-exec-redis-info",
    description: "Redis info inside Docker",
    adapters: ["server-resource-script-plan"],
    pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ redis-cli INFO server$/,
  },
  {
    key: "docker-exec-redis-ping",
    description: "Redis ping inside Docker",
    adapters: ["resource-connection-plan"],
    pattern: /^docker exec [a-zA-Z0-9_.:/@-]+ redis-cli PING$/,
  },
  {
    key: "backup-directory",
    description: "Create Devpilot backup directory",
    adapters: ["server-resource-script-plan", "backup-script-plan"],
    pattern: /^mkdir -p \/var\/backups\/devpilot\/(?:mysql|redis)$/,
  },
  {
    key: "docker-compose-status",
    description: "Docker Compose status",
    adapters: ["application-service-runtime-plan"],
    pattern: /^docker compose ps (?:'[^']+'|[a-zA-Z0-9_.:/@-]+)$/,
  },
  {
    key: "docker-compose-logs",
    description: "Docker Compose logs tail",
    adapters: ["application-service-runtime-plan", "log-collection-plan"],
    pattern:
      /^docker compose logs --tail=\d{1,5} (?:'[^']+'|[a-zA-Z0-9_.:/@-]+)$/,
  },
  {
    key: "docker-compose-restart",
    description: "Docker Compose restart",
    adapters: ["application-service-runtime-plan"],
    pattern: /^docker compose restart (?:'[^']+'|[a-zA-Z0-9_.:/@-]+)$/,
  },
];
