export interface ComposeOptions {
  projectName: string;
  /** MySQL 端口，默认 3306。 */
  mysqlPort?: number;
  /** Redis 端口，默认 6379。 */
  redisPort?: number;
}

/**
 * 生成开发用的 `docker-compose.yml` 内容（MySQL 8.0 + Redis 7）。
 *
 * 由 `svton create`（新项目根）与 `svton services init`（已存在仓库）共用，
 * 保证两处生成的 compose 形态完全一致，避免漂移。
 */
export function generateDockerCompose(options: ComposeOptions): string {
  const { projectName, mysqlPort = 3306, redisPort = 6379 } = options;
  return `version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: ${projectName}-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root123456
      MYSQL_DATABASE: ${projectName}
      MYSQL_USER: ${projectName}
      MYSQL_PASSWORD: ${projectName}123456
    ports:
      - '${mysqlPort}:3306'
    volumes:
      - mysql_data:/var/lib/mysql
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    container_name: ${projectName}-redis
    restart: unless-stopped
    ports:
      - '${redisPort}:6379'
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
`;
}
