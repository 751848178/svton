import { ServerService } from "../../server/server.service";
import { SshTransportCredentials } from "../../common/ssh/ssh-transport";

/**
 * SSH 凭据映射的单一事实来源（F383 §A.4 受控 password transport）。
 *
 * 之前 `toSshTransportCredentials` 无条件把 `credentials` 当作 privateKey，
 * 同时 adapter 硬编码拒绝 password auth，导致 password 类服务器无法走 live 发布。
 * 这里按 `authType` 统一映射 key/password，未知类型 fail-closed，供 execute、
 * 取消、超时、远端清理、stale recovery 共用——不再在每个路径重复分支判断。
 *
 * 安全：映射结果只含 transport 需要的最小字段；任何抛错都不携带明文凭据。
 */

/** 解密后的服务器凭据（与 `ServerService.getDecryptedCredentials` 返回一致）。 */
export type DecryptedServerCredentials = Awaited<
  ReturnType<ServerService["getDecryptedCredentials"]>
>;

/** 受支持的 authType（与 `AuthType` 枚举对齐，集中避免散落字符串）。 */
export const SUPPORTED_SSH_AUTH_TYPES = ["key", "password"] as const;
export type SupportedSshAuthType = (typeof SUPPORTED_SSH_AUTH_TYPES)[number];

/** 最小无副作用命令：用于连接测试与执行器 capability 预检（不写不删）。 */
export const SSH_CAPABILITY_PROBE_COMMAND = "true";

/**
 * fail-closed 错误：未知 authType 或映射缺失时抛出。
 * 消息可操作（指出应改什么），但**绝不**包含明文密码 / 私钥。
 */
export class SshCredentialMappingError extends Error {
  constructor(
    message: string,
    readonly authType: string | null | undefined,
  ) {
    super(message);
    this.name = "SshCredentialMappingError";
  }
}

/** 判断 authType 是否受 live executor 支持。 */
export function isSupportedSshAuthType(
  authType: string | null | undefined,
): authType is SupportedSshAuthType {
  return (
    typeof authType === "string" &&
    (SUPPORTED_SSH_AUTH_TYPES as readonly string[]).includes(authType)
  );
}

/**
 * 把 authType 映射到 transport 凭据字段名（key→privateKey, password→password）。
 * 未知类型抛 `SshCredentialMappingError`（fail-closed，可操作文案，无明文）。
 */
export function mapAuthTypeToTransportField(
  authType: string | null | undefined,
): "privateKey" | "password" {
  if (authType === "key") return "privateKey";
  if (authType === "password") return "password";
  throw new SshCredentialMappingError(
    buildUnsupportedAuthTypeMessage(authType),
    authType,
  );
}

/**
 * 把解密凭据按 authType 映射为 transport 凭据（key→privateKey, password→password）。
 * 未知 authType fail-closed；password 只落到 `password` 字段，永不混入 privateKey。
 */
export function toSshTransportCredentials(
  credentials: DecryptedServerCredentials,
): SshTransportCredentials {
  const field = mapAuthTypeToTransportField(credentials.authType);
  const secret = credentials.credentials;
  return {
    host: credentials.host,
    port: credentials.port,
    username: credentials.username,
    [field]: secret,
  };
}

/** 受支持认证方式的人类可读清单，用于 UI/错误提示。 */
export function describeSupportedAuthTypes(): string {
  return SUPPORTED_SSH_AUTH_TYPES.join(" / ");
}

/** 未知 authType 的可操作错误文案（无明文）。 */
export function buildUnsupportedAuthTypeMessage(
  authType: string | null | undefined,
): string {
  const shown = authType || "(空)";
  return (
    `SSH live executor 不支持认证类型「${shown}」；` +
    `请在服务器配置中选择受支持的方式（${describeSupportedAuthTypes()}）后重试。`
  );
}
