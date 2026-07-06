import { ServerCommandStep } from "../server-executor/server-executor.types";
import {
  firstCommandToken,
  normalizeVarLogPath,
  toRecord,
} from "./log-center-value.utils";

type LogServerCollectionPlanStream = {
  sourceKey?: string | null;
  sourceType: string;
  serverId?: string | null;
  applicationService?: {
    deployConfig?: unknown;
    kind?: string | null;
    name?: string | null;
  } | null;
  managedResource?: {
    config?: unknown;
    externalId?: string | null;
    name?: string | null;
  } | null;
};

export function buildServerCollectionSteps(
  stream: LogServerCollectionPlanStream,
  tail: number,
) {
  const warnings: string[] = [];
  const steps: ServerCommandStep[] = [];

  if (!stream.serverId) {
    warnings.push(
      "日志流没有绑定服务器，无法通过 Server executor 生成采集命令。",
    );
  }

  if (stream.sourceType === "docker") {
    const dockerStep = buildDockerLogStep(stream, tail);
    if (!dockerStep.command) {
      warnings.push("未找到可用的 Docker 容器名或 Docker Compose 服务名。");
    }
    steps.push(dockerStep);
    return { steps, warnings };
  }

  if (stream.sourceType === "nginx") {
    const sourcePath = normalizeVarLogPath(stream.sourceKey, "nginx");
    if (sourcePath) {
      steps.push({
        key: "tail-nginx-source",
        label: "采集 Nginx 指定日志",
        command: `tail -n ${tail} ${sourcePath}`,
        required: true,
        risk: "low",
        timeoutSeconds: 15,
      });
      return { steps, warnings };
    }

    steps.push(
      {
        key: "tail-nginx-access",
        label: "采集 Nginx access.log",
        command: `tail -n ${tail} /var/log/nginx/access.log`,
        required: false,
        risk: "low",
        timeoutSeconds: 15,
      },
      {
        key: "tail-nginx-error",
        label: "采集 Nginx error.log",
        command: `tail -n ${tail} /var/log/nginx/error.log`,
        required: false,
        risk: "low",
        timeoutSeconds: 15,
      },
    );
    return { steps, warnings };
  }

  const sourcePath = normalizeVarLogPath(stream.sourceKey);
  if (!sourcePath) {
    warnings.push("服务器日志流需要 sourceKey 指向 /var/log 下的 .log 文件。");
  }

  steps.push({
    key: "tail-var-log",
    label: "采集服务器日志文件",
    command: sourcePath ? `tail -n ${tail} ${sourcePath}` : "",
    required: true,
    risk: "low",
    timeoutSeconds: 15,
  });

  return { steps, warnings };
}

function buildDockerLogStep(
  stream: LogServerCollectionPlanStream,
  tail: number,
): ServerCommandStep {
  const deployConfig = toRecord(stream.applicationService?.deployConfig);
  const resourceConfig = toRecord(stream.managedResource?.config);
  const kind = stream.applicationService?.kind || "";
  const composeService = firstCommandToken(
    stream.sourceKey,
    deployConfig.serviceName,
    deployConfig.composeService,
    deployConfig.service,
    stream.applicationService?.name,
  );

  if (kind === "docker-compose" && composeService) {
    return {
      key: "docker-compose-logs",
      label: "采集 Docker Compose 服务日志",
      command: `docker compose logs --tail=${tail} ${composeService}`,
      required: true,
      risk: "low",
      timeoutSeconds: 20,
    };
  }

  const containerName = firstCommandToken(
    stream.sourceKey,
    deployConfig.containerName,
    deployConfig.container,
    resourceConfig.containerName,
    stream.managedResource?.externalId,
    stream.applicationService?.name,
    stream.managedResource?.name,
  );

  return {
    key: "docker-logs",
    label: "采集 Docker 容器日志",
    command: containerName ? `docker logs --tail=${tail} ${containerName}` : "",
    required: true,
    risk: "low",
    timeoutSeconds: 20,
  };
}
