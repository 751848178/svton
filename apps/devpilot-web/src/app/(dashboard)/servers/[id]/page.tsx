'use client';

import { useParams, useRouter } from 'next/navigation';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { useServerDetail } from './hooks/use-server-detail';
import { ServerDetailView } from './components/server-detail-view';

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const {
    server,
    loading,
    testing,
    detecting,
    editing,
    editForm,
    setEditForm,
    setEditing,
    testConnection,
    detectServices,
    save,
    remove,
  } = useServerDetail(serverId);

  const handleDelete = usePersistFn(async () => {
    if (!confirm('确定要删除这个服务器吗？关联的代理配置也会被删除。')) return;
    await remove();
    router.push('/servers');
  });

  if (loading) return <LoadingState text="加载中..." />;

  if (!server) {
    return (
      <EmptyState
        text="服务器不存在"
        action={
          <button
            onClick={() => router.push('/servers')}
            className="text-primary hover:underline"
          >
            返回列表
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/servers')}
          className="text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{server.name}</h1>
        <StatusTag status={server.status} />
      </div>

      <ServerDetailView
        server={server}
        editing={editing}
        editForm={editForm}
        detecting={detecting}
        onEditFormChange={setEditForm}
        onStartEdit={() => setEditing(true)}
        onCancelEdit={() => setEditing(false)}
        onSave={save}
        onDetect={detectServices}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-start-3">
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 font-semibold">操作</h2>
            <div className="space-y-2">
              <button
                onClick={testConnection}
                disabled={testing}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {testing ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={() => router.push(`/proxy-configs/new?serverId=${server.id}`)}
                className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                添加代理配置
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-destructive/50 p-6">
            <h2 className="mb-4 font-semibold text-destructive">危险操作</h2>
            <button
              onClick={handleDelete}
              className="w-full rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              删除服务器
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
