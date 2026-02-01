'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface SecretKey {
  id: string;
  name: string;
  type: string;
  description?: string;
  projectId?: string;
  createdAt: string;
}

const keyTypes = [
  { value: 'jwt_secret', label: 'JWT Secret', icon: '🔐' },
  { value: 'encryption_key', label: '加密密钥', icon: '🔑' },
  { value: 'api_key', label: 'API Key', icon: '🎫' },
  { value: 'oauth_secret', label: 'OAuth Secret', icon: '🔒' },
  { value: 'database_password', label: '数据库密码', icon: '💾' },
  { value: 'custom', label: '自定义', icon: '⚙️' },
];

export default function KeyCenterPage() {
  const [keys, setKeys] = useState<SecretKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string>('');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    type: 'jwt_secret',
    value: '',
    description: '',
  });
  const [generateForm, setGenerateForm] = useState({
    type: 'jwt_secret',
    length: 64,
  });

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const data = await api.get<SecretKey[]>('/keys');
      setKeys(data);
    } catch (error) {
      console.error('Failed to load keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await api.post<{ key: string; type: string }>('/keys/generate', generateForm);
      setGeneratedKey(result.key);
      setFormData({ ...formData, type: generateForm.type, value: result.key });
    } catch (error) {
      console.error('Failed to generate key:', error);
    }
  };

  const handleStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/keys', formData);
      setShowModal(false);
      setFormData({ name: '', type: 'jwt_secret', value: '', description: '' });
      setGeneratedKey('');
      loadKeys();
    } catch (error) {
      console.error('Failed to store key:', error);
    }
  };

  const handleReveal = async (keyId: string) => {
    if (revealedKeys[keyId]) {
      setRevealedKeys({ ...revealedKeys, [keyId]: '' });
      return;
    }
    try {
      const value = await api.get<string>(`/keys/${keyId}/value`);
      setRevealedKeys({ ...revealedKeys, [keyId]: value });
    } catch (error) {
      console.error('Failed to reveal key:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个密钥吗？此操作不可恢复。')) return;
    try {
      await api.delete(`/keys/${id}`);
      loadKeys();
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const getTypeInfo = (type: string) => {
    return keyTypes.find(t => t.value === type) || { label: type, icon: '🔑' };
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
          <h1 className="text-2xl font-bold text-gray-900">密钥中心</h1>
          <p className="text-gray-600 mt-1">安全存储和管理各类密钥</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
          >
            生成密钥
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            存储密钥
          </button>
        </div>
      </div>

      {/* 密钥列表 */}
      <div className="grid gap-4">
        {keys.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500">暂无存储的密钥</p>
            <p className="text-sm text-gray-400 mt-1">点击"生成密钥"或"存储密钥"开始</p>
          </div>
        ) : (
          keys.map((key) => {
            const typeInfo = getTypeInfo(key.type);
            return (
              <div key={key.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{typeInfo.icon}</span>
                    <div>
                      <h3 className="font-medium text-gray-900">{key.name}</h3>
                      <p className="text-sm text-gray-500">{typeInfo.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReveal(key.id)}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      {revealedKeys[key.id] ? '隐藏' : '查看'}
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {key.description && (
                  <p className="text-sm text-gray-500 mt-2">{key.description}</p>
                )}

                {revealedKeys[key.id] && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-800 break-all">{revealedKeys[key.id]}</code>
                      <button
                        onClick={() => copyToClipboard(revealedKeys[key.id])}
                        className="ml-2 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded"
                      >
                        复制
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  创建于 {new Date(key.createdAt).toLocaleString()}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* 生成密钥模态框 */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">生成密钥</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密钥类型</label>
                <select
                  value={generateForm.type}
                  onChange={(e) => setGenerateForm({ ...generateForm, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {keyTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">长度</label>
                <input
                  type="number"
                  value={generateForm.length}
                  onChange={(e) => setGenerateForm({ ...generateForm, length: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                  min={16}
                  max={128}
                />
              </div>
              <button
                onClick={handleGenerate}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                生成
              </button>

              {generatedKey && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 mb-2">生成成功！</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white p-2 rounded break-all">{generatedKey}</code>
                    <button
                      onClick={() => copyToClipboard(generatedKey)}
                      className="px-2 py-1 text-sm text-green-600 hover:bg-green-100 rounded"
                    >
                      复制
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setShowGenerateModal(false);
                      setFormData({ ...formData, type: generateForm.type, value: generatedKey });
                      setShowModal(true);
                    }}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    保存到密钥中心 →
                  </button>
                </div>
              )}

              <button
                onClick={() => { setShowGenerateModal(false); setGeneratedKey(''); }}
                className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 存储密钥模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">存储密钥</h2>
            <form onSubmit={handleStore} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="如: PROD_JWT_SECRET"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {keyTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密钥值</label>
                <textarea
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  rows={3}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="用途说明"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setGeneratedKey(''); }}
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
