/**
 * 凭证列表表格
 *
 * 单一职责：渲染 CDN 凭证列表 + 删除操作。
 */

import { usePersistFn } from '@svton/hooks';
import type { TeamCredential } from '../types';

interface CredentialTableProps {
  credentials: TeamCredential[];
  onDelete: (id: string) => void;
}

export function CredentialTable({ credentials, onDelete }: CredentialTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
            <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
            <th className="px-4 py-3 text-left text-sm font-medium">创建时间</th>
            <th className="px-4 py-3 text-right text-sm font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {credentials.map((cred) => (
            <CredentialRow
              key={cred.id}
              credential={cred}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CredentialRow({
  credential,
  onDelete,
}: {
  credential: TeamCredential;
  onDelete: (id: string) => void;
}) {
  const handleDelete = usePersistFn(() => onDelete(credential.id));
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 font-medium">{credential.name}</td>
      <td className="px-4 py-3 text-sm">{credential.type.replace('cdn_', '').toUpperCase()}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {new Date(credential.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={handleDelete}
          className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
        >
          删除
        </button>
      </td>
    </tr>
  );
}
