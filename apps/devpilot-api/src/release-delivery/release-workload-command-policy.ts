import { UnprocessableEntityException } from "@nestjs/common";
import { redactRepositoryText } from "../repository-analysis/repository-analysis-redact.utils";
import { quoteReleaseShell } from "./release-shell-quote.utils";

const SAFE_TOKEN = /^[A-Za-z0-9_./:@%+,-]+$/;
const SHELL_EXECUTABLE = /^(?:ba|da|z)?sh$/i;
const SCRIPT_EXECUTABLE = /^(?:node|python3?|ruby|perl)$/i;
const FILE_TEST_PREDICATE = /^-(?:[defrswx])$/;

export function assertSafeReleaseWorkloadCommand(
  value: unknown,
  label: string,
  service: string,
) {
  const command = typeof value === "string" ? value.trim() : "";
  const tokens = command ? command.split(/\s+/) : [];
  if (!command || tokens.length === 0) {
    throw invalidCommand(service, `缺少${label}命令`);
  }
  if (
    redactRepositoryText(command) !== command ||
    tokens.some((token) => !safeToken(token)) ||
    !hasAllowedExecutableAndOperation(tokens)
  ) {
    throw invalidCommand(
      service,
      `${label}命令必须是 exact Manifest 内的无 Shell 插值命令`,
    );
  }
  return tokens.join(" ");
}

export function buildReleaseWorkloadCommandInvocation(command: string) {
  return assertSafeReleaseWorkloadCommand(command, "运行", "workload")
    .split(" ")
    .map(quoteReleaseShell)
    .join(" ");
}

function safeToken(token: string) {
  if (!SAFE_TOKEN.test(token)) return false;
  const path = token.replace(/^--[^=]+=/, "");
  return (
    !path.startsWith("/") &&
    !path.startsWith("~") &&
    !path.includes("://") &&
    !path.split("/").includes("..") &&
    path !== "."
  );
}

function hasAllowedExecutableAndOperation(tokens: string[]) {
  const executable = tokens[0].toLowerCase();
  if (executable === "true" || executable === "false") {
    return tokens.length === 1;
  }
  if (executable === "test") {
    return (
      tokens.length === 3 &&
      FILE_TEST_PREDICATE.test(tokens[1]) &&
      isArtifactPath(tokens[2])
    );
  }
  if (executable === "java") {
    return tokens[1] === "-jar" && isArtifactPath(tokens[2]);
  }
  if (SHELL_EXECUTABLE.test(executable) || SCRIPT_EXECUTABLE.test(executable)) {
    return isArtifactPath(tokens[1]);
  }
  return isArtifactExecutable(tokens[0]);
}

function isArtifactPath(value: string | undefined) {
  if (!value) return false;
  return (
    !value.startsWith("/") &&
    !value.split("/").includes("..") &&
    (value.includes("/") || /\.[A-Za-z0-9]+$/.test(value))
  );
}

function isArtifactExecutable(value: string) {
  return (
    isArtifactPath(value) && (value.startsWith("./") || value.includes("/"))
  );
}

function invalidCommand(service: string, message: string) {
  return new UnprocessableEntityException(`服务 ${service} 的${message}`);
}
