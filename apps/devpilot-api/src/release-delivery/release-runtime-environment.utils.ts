const ENVIRONMENT_KEY = /^[A-Z_][A-Z0-9_]*$/;
const UNQUOTED_VALUE = /^[A-Za-z0-9_./:@%+,=-]*$/;

export function formatReleaseRuntimeEnvironment(
  environment: Record<string, string>,
) {
  return Object.entries(environment)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      if (!ENVIRONMENT_KEY.test(key)) {
        throw new Error(`运行时环境变量键无效：${key}`);
      }
      const normalized = value
        .replace(/\r\n/g, "\\n")
        .replace(/[\r\n]/g, "\\n");
      return `${key}=${shellSafeValue(normalized)}`;
    })
    .join("\n");
}

function shellSafeValue(value: string) {
  if (UNQUOTED_VALUE.test(value)) return value;
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
