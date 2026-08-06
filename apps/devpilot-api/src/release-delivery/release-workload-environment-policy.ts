import { ConflictException } from "@nestjs/common";

const EXECUTION_CONTROL_KEYS = new Set([
  "BASH_ENV",
  "BASHOPTS",
  "CDPATH",
  "CLASSPATH",
  "COMPOSE_FILE",
  "COMPOSE_PATH_SEPARATOR",
  "COMPOSE_PROJECT_NAME",
  "DOCKER_CERT_PATH",
  "DOCKER_CONFIG",
  "DOCKER_CONTEXT",
  "DOCKER_HOST",
  "DOCKER_TLS_VERIFY",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "ENV",
  "IFS",
  "JDK_JAVA_OPTIONS",
  "JAVA_TOOL_OPTIONS",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "HELM_CACHE_HOME",
  "HELM_CONFIG_HOME",
  "HELM_DATA_HOME",
  "HELM_DRIVER",
  "KUBECONFIG",
  "NODE_OPTIONS",
  "NODE_PATH",
  "PATH",
  "PERL5LIB",
  "PERL5OPT",
  "PYTHONHOME",
  "PYTHONPATH",
  "RUBYLIB",
  "RUBYOPT",
  "SHELLOPTS",
  "_JAVA_OPTIONS",
]);

export function assertSafeReleaseWorkloadEnvironment(
  environment: Record<string, string>,
) {
  const key = Object.keys(environment).find((item) =>
    EXECUTION_CONTROL_KEYS.has(item.toUpperCase()),
  );
  if (key) {
    throw new ConflictException(`运行时环境变量 ${key} 不得覆盖执行控制边界`);
  }
}
