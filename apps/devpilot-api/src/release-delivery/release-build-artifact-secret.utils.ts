import { extname } from "node:path";
import {
  containsRepositorySecretText,
  containsRepositoryStrongSecretText,
  containsRepositoryStructuredSecretText,
} from "../repository-analysis/repository-analysis-redact.utils";

const CONFIGURATION_EXTENSIONS = new Set([
  ".bash",
  ".conf",
  ".config",
  ".ini",
  ".properties",
  ".service",
  ".sh",
  ".toml",
  ".zsh",
]);
const STRUCTURED_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);
const DELIMITED_SECRET_KEY =
  /(?:^|[_.-])(?:token|password|secret|authorization|credentials?|private[-_]?key|api[-_]?key|access[-_]?key|secret[-_]?key)(?:$|[_.-])/i;
const CAMEL_SECRET_KEY =
  /(?:Token|Password|Secret|Authorization|Credentials?|PrivateKey|ApiKey|APIKey|AccessKey|SecretKey)$/;

export function containsReleaseBuildArtifactSecretText(
  path: string,
  value: string,
): boolean {
  if (containsRepositoryStrongSecretText(value)) return true;
  const extension = extname(path).toLowerCase();
  if (STRUCTURED_EXTENSIONS.has(extension)) {
    return containsRepositoryStructuredSecretText(value, isArtifactSecretKey);
  }
  return (
    CONFIGURATION_EXTENSIONS.has(extension) &&
    containsRepositorySecretText(value)
  );
}

function isArtifactSecretKey(key: string) {
  return DELIMITED_SECRET_KEY.test(key) || CAMEL_SECRET_KEY.test(key);
}
