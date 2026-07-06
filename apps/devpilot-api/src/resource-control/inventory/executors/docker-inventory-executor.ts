/**
 * Docker inventory 执行端口（抽象）。
 *
 * 把"如何获取 docker 容器列表"从 resource-control 解耦，使实现可替换：
 *  - {@link CliDockerInventoryExecutor}：通过 server-executor SSH 远程跑
 *    `docker ps --format '{{json .}}'`，解析 stdout（当前生产实现，远端服务器只有 CLI）
 *  - {@link DockerApiInventoryExecutor}：通过 dockerode 直连 Docker daemon
 *    （本机或远端开了 Docker API 的场景，返回结构化 JSON 无需文本解析）
 *
 * resource-control 通过此端口获取容器列表，inventory 解析逻辑（buildDockerInventorySeedsFromDockerPs）
 * 仍复用——只是数据来源（CLI stdout vs dockerode listContainers）可替换。
 */
export const DOCKER_INVENTORY_EXECUTOR = Symbol('DOCKER_INVENTORY_EXECUTOR');

/** 统一的容器记录（docker ps JSON 行 或 dockerode listContainers 归一化后）。 */
export interface DockerContainerRecord {
  ID: string;
  Image: string;
  Names: string;
  Ports: string;
  State: string;
  Status: string;
  Labels: string;
  Networks: string;
  RunningFor: string;
}

export interface DockerInventoryQuery {
  teamId: string;
  serverId: string;
}

export interface DockerInventoryExecutor {
  /**
   * 列出目标服务器的容器（docker ps -a 等价）。
   * 返回归一化后的容器记录列表，供 buildDockerInventorySeedsFromDockerPs 解析。
   */
  listContainers(query: DockerInventoryQuery): Promise<DockerContainerRecord[]>;
}
