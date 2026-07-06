import { Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import {
  DockerContainerRecord,
  DockerInventoryExecutor,
  DockerInventoryQuery,
} from './docker-inventory-executor';

/**
 * 基于 dockerode 的 inventory executor（直连 Docker daemon）。
 *
 * 适用于"目标开了 Docker API（TCP socket + TLS 或本机 unix socket）"的场景。
 * 返回结构化容器数据，无需解析 `docker ps` 文本输出。
 *
 * 当前未作为默认（远端服务器多只装 CLI），但作为 {@link DockerInventoryExecutor}
 * 的可用实现存在——配置了 Docker API 的服务器可切换到本实现。
 *
 * 注：本类需要 Docker daemon 连接信息（host/port 或 socket path），
 * 由调用方在构造时传入或从 server credential 解析。
 */
@Injectable()
export class DockerApiInventoryExecutor implements DockerInventoryExecutor {
  private readonly logger = new Logger(DockerApiInventoryExecutor.name);
  private readonly docker: Docker;

  constructor(options?: Docker.DockerOptions) {
    this.docker = new Docker(options ?? { socketPath: '/var/run/docker.sock' });
  }

  async listContainers(_query: DockerInventoryQuery): Promise<DockerContainerRecord[]> {
    const containers = await this.docker.listContainers({ all: true });

    return containers.map((c) => ({
      ID: c.Id,
      Image: c.Image,
      Names: (c.Names || []).join(','),
      Ports: (c.Ports || [])
        .map((p) => (p.IP ? `${p.IP}:${p.PublicPort}->` : '') + `${p.PrivatePort}/${p.Type}`)
        .join(', '),
      State: c.State,
      Status: c.Status,
      Labels: Object.entries(c.Labels || {})
        .map(([k, v]) => (v ? `${k}=${v}` : k))
        .join(','),
      Networks: Object.keys(c.NetworkSettings?.Networks || {}).join(','),
      RunningFor: c.Status, // dockerode 不单独提供 RunningFor，用 Status 近似
    }));
  }
}
