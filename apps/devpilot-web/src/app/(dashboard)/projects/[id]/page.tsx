'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Project {
  id: string;
  name: string;
  gitRepo: string | null;
  config: {
    projectName?: string;
    description?: string;
    subProjects?: string[];
  };
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string | null; email: string };
  proxyConfigs?: Array<{ id: string; name: string; domain: string; status: string }>;
  cdnConfigs?: Array<{ id: string; name: string; domain: string; provider: string }>;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const data = await api.get<Project>(`/projects/${projectId}`);
      setProject(data);
      setEditForm({
        name: data.name,
        description: data.config.description || '',
      });
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put(`/projects/${projectId}`, {
        name: editForm.name,
        config: { ...project?.config, description: editForm.description },
      });
      setEditing(false);
      loadProject();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个项目吗？此操作不可恢复。')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      router.push('/projects');
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">项目不存在</p>
        <button onClick={() => router.push('/projects')} className="mt-4 text-primary hover:underline">
          返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/projects')} className="text-muted-foreground hover:text-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">{project.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 基本信息 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">基本信息</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">
                  编辑
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:underline">
                    取消
                  </button>
                  <button onClick={handleSave} className="text-sm text-primary hover:underline">
                    保存
                  </button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">项目名称</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">描述</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <dt className="text-muted-foreground">描述</dt>
                  <dd>{project.config.description || '无描述'}</dd>
                </div>
                {project.gitRepo && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Git 仓库</dt>
                    <dd>
                      <a href={project.gitRepo} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">
                        {project.gitRepo}
                      </a>
                    </dd>
                  </div>
                )}
                {project.config.subProjects && project.config.subProjects.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">子项目</dt>
                    <dd className="flex gap-1 mt-1">
                      {project.config.subProjects.map((sub, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-muted">{sub}</span>
                      ))}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">创建时间</dt>
                  <dd>{new Date(project.createdAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">更新时间</dt>
                  <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
            )}
          </div>

          {/* 关联的代理配置 */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">代理配置</h2>
              <Link href={`/proxy-configs?new=true&projectId=${project.id}`} className="text-sm text-primary hover:underline">
                添加
              </Link>
            </div>
            {project.proxyConfigs && project.proxyConfigs.length > 0 ? (
              <div className="space-y-2">
                {project.proxyConfigs.map((config) => (
                  <Link
                    key={config.id}
                    href={`/proxy-configs/${config.id}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{config.domain}</div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      config.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {config.status === 'active' ? '已生效' : '待同步'}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">暂无关联的代理配置</p>
            )}
          </div>

          {/* 关联的 CDN 配置 */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">CDN 配置</h2>
              <Link href={`/cdn-configs?new=true&projectId=${project.id}`} className="text-sm text-primary hover:underline">
                添加
              </Link>
            </div>
            {project.cdnConfigs && project.cdnConfigs.length > 0 ? (
              <div className="space-y-2">
                {project.cdnConfigs.map((config) => (
                  <Link
                    key={config.id}
                    href={`/cdn-configs/${config.id}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md hover:bg-muted"
                  >
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{config.domain}</div>
                    </div>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                      {config.provider}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">暂无关联的 CDN 配置</p>
            )}
          </div>
        </div>

        {/* 操作面板 */}
        <div className="space-y-4">
          <div className="border rounded-lg p-6">
            <h2 className="font-semibold mb-4">快捷操作</h2>
            <div className="space-y-2">
              {project.gitRepo && (
                <a
                  href={project.gitRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  查看仓库
                </a>
              )}
              <Link
                href={`/proxy-configs?new=true&projectId=${project.id}`}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center"
              >
                添加代理配置
              </Link>
              <Link
                href={`/cdn-configs?new=true&projectId=${project.id}`}
                className="w-full px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent flex items-center justify-center"
              >
                添加 CDN 配置
              </Link>
            </div>
          </div>

          <div className="border rounded-lg p-6 border-destructive/50">
            <h2 className="font-semibold text-destructive mb-4">危险操作</h2>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除项目
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
