import { ApiError } from '@svton/api-client';
import { ErrorMessage } from './primitives';

export function ConfigStoreError({ error }: { error: unknown }) {
  return <><ErrorMessage error={error} />{error instanceof ApiError && error.code === 503 && <p className="notice-message">配置存储暂不可用。请联系平台管理员检查配置主密钥及文件权限；已有加密配置需要恢复原密钥，不能用新密钥替换。</p>}</>;
}
