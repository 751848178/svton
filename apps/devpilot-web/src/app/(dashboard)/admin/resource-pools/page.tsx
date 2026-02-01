'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ResourcePool {
  id: string;
  type: string;
  name: string;
  endpoint: string;
  capacity: number;
  allocated: number;
  available: number;
  status: string;
  createdAt: string;
}

const poolTypes = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'redis', label: 'Redis' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'cdn', label: 'CDN' },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  full: 'bg-red-100 text-red-800',
};

export default function ResourcePoolsPage() {
  const [pools, setPools] = useState<ResourcePool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPool, setEditingPool] = useState<ResourcePool | null>(null);
  const [formData, setFormData] = useState({
    type: 'mysql',
    name: '',
    endpoint: '',
    capacity: 10,
    adminConfig: {} as Record<string, string>,
  });

  useEffect(() => {
    loadPools();
  }, []);

  const loadPools = async () => {
    try {
      const data = await api.get<ResourcePool[]>('/resource-pools');
      setPools(data);
    } catch (error) {
      console.error('Failed to load pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPool) {
        await api.put(`/resource-pools/${editingPool.id}`, formData);
      } else {
        await api.post('/resource-pools', formData);
      }
      setShowModal(false);
      setEditingPool(null);
      resetForm();
      loadPools();
    } catch (error) {
      console.error('Failed to save pool:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个资源池吗？')) return;
    try {
      await api.delete(`/resource-pools/${id}`);
      loadPools();
    } catch (error) {
      console.error('Failed to delete pool:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'mysql',
      name: '',
      endpoint: '',
      capacity: 10,
      adminConfig: {},
    });
  };

  const openEditModal = (pool: ResourcePool) => {
    setEditingPool(pool);
    setFormData({
      type: pool.type,
      name: pool.name,
      endpoint: pool.endpoint,
      capacity: pool.capacity,
      adminConfig: {},
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">资源池管理</h1>
          <p className="text-gray-600 mt-1">管理 MySQL、Redis 等资源池</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          添加资源池
        </button>
      </div>

      {/* 资源池列表 */}
      <div className="grid gap-4">
        {pools.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">暂无资源池</p>
          </div>
        ) : (
          pools.map((pool) => (
            <div key={pool.id} className="bg-white rounded-lg border p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 font-bold">{pool.type.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{pool.name}</h3>
                    <p className="text-sm text-gray-500">{pool.endpoint}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[pool.status]}`}>
                  {pool.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">类型</p>
                  <p className="font-medium">{pool.type.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">容量</p>
                  <p className="font-medium">{pool.allocated} / {pool.capacity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">可用</p>
                  <p className="font-medium">{pool.available}</p>
                </div>
              </div>

              {/* 进度条 */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(pool.allocated / pool.capacity) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEditModal(pool)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(pool.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 添加/编辑模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">
              {editingPool ? '编辑资源池' : '添加资源池'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={!!editingPool}
                >
                  {poolTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">连接地址</label>
                <input
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="如: mysql://host:3306"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">容量</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={1}
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingPool(null); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
