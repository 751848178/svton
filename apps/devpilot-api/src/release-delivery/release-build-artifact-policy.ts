import { basename } from "node:path";
import { ReleaseBuildExecutionError } from "./release-build-execution.error";

const SENSITIVE_FILE =
  /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.netrc|\.dockerconfigjson|\.git-credentials|credentials(?:\..*)?|id_(?:rsa|dsa|ecdsa|ed25519)(?:\..*)?|.*(?:^|[._-])(?:secret|token|private[-_]?key|access[-_]?key)(?:[._-].*)?|.*\.(?:pem|key|p12|pfx))$/i;
const TEMPORARY_DIRECTORY = /^(?:tmp|temp|\.tmp|\.temp|\.cache|\.turbo)$/i;

export function assertSafeArtifactPath(path: string, directory: boolean) {
  const segments = path.split("/");
  if (segments.includes(".git")) {
    throw artifactFailure(
      "ARTIFACT_UNSAFE_ENTRY",
      `制品输出包含 .git：${path}`,
    );
  }
  if (directory && TEMPORARY_DIRECTORY.test(basename(path))) {
    throw artifactFailure(
      "ARTIFACT_UNSAFE_ENTRY",
      `制品输出包含临时目录：${path}`,
    );
  }
  if (!directory && SENSITIVE_FILE.test(basename(path))) {
    throw artifactFailure(
      "ARTIFACT_SECRET_FILE",
      `制品输出包含敏感文件名：${path}`,
    );
  }
}

export function artifactFailure(code: string, message: string) {
  return new ReleaseBuildExecutionError({
    code,
    message,
    logs: [],
    gateSummary: {
      artifact: { status: "failed" },
      action: "修正显式制品输出声明或构建结果后重试。",
    },
  });
}
