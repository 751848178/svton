'use client';

import { useProjectConfigStore } from '@/store/project-config';
import { useState } from 'react';

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

// 资源类型定义（后续会从 API 获取）
const resourceTypes: Record<string, {
  name: string;
  fields: { key: string; label: string; type: string; required?: boolean; default?: string | number }[];
}> = {
  redis: {
    name: 'Redis',
    fields: [
      { key: 'host', label: '主机地址', type: 'text', required: true },
      { key: 'port', label: '端口', type: 'number', default: 6379 },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'db', label: '数据库', type: 'number', default: 0 },
    ],
  },
  mysql: {
    name: 'MySQL',
    fields: [
      { key: 'host', label: '主机地址', type: 'text', required: true },
      { key: 'port', label: '端口', type: 'number', default: 3306 },
      { key: 'username', label: '用户名', type: 'text', required: true },
      { key: 'password', label: '密码', type: 'password', required: true },
      { key: 'database', label: '数据库名', type: 'text', required: true },
    ],
  },
  'qiniu-kodo': {
    name: '七牛云 Kodo',
    fields: [
      { key: 'accessKey', label: 'Access Key', type: 'text', required: true },
      { key: 'secretKey', label: 'Secret Key', type: 'password', required: true },
      { key: 'bucket', label: 'Bucket', type: 'text', required: true },
      { key: 'domain', label: 'CDN 域名', type: 'text', required: true },
    ],
  },
  'sms-aliyun': {
    name: '阿里云短信',
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
      { key: 'accessKeySecret', label: 'Access Key Secret', type: 'password', required: true },
      { key: 'signName', label: '签名', type: 'text', required: true },
    ],
  },
};

// 功能到资源的映射
const featureResourceMap: Record<string, string[]> = {
  cache: ['redis'],
  'rate-limit': ['redis'],
  queue: ['redis'],
  'object-storage-qiniu': ['qiniu-kodo'],
  sms: ['sms-aliyun'],
};

export function StepResources({ onNext, onPrev }: StepProps) {
  const { config } = useProjectConfigStore();
  const [resourceConfigs, setResourceConfigs] = useState<Record<string, Record<string, string>>>({});
  const [skipResources, setSkipResources] = useState<Set<string>>(new Set());

  // 获取需要配置的资源
  const requiredResources = new Set<string>();
  config.features.forEach((featureId) => {
    const resources = featureResourceMap[featureId] || [];
    resources.forEach((r) => requiredResources.add(r));
  });

  // 默认添加 MySQL（后端项目需要）
  if (config.subProjects.backend) {
    requiredResources.add('mysql');
  }

  const handleFieldChange = (resourceType: string, field: string, value: string) => {
    setResourceConfigs((prev) => ({
      ...prev,
      [resourceType]: {
        ...prev[resourceType],
        [field]: value,
      },
    }));
  };

  const toggleSkip = (resourceType: string) => {
    setSkipResources((prev) => {
      const next = new Set(prev);
      if (next.has(resourceType)) {
        next.delete(resourceType);
      } else {
        next.add(resourceType);
      }
      return next;
    });
  };

  if (requiredResources.size === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            当前配置不需要额外的资源凭证
          </p>
        </div>

        <div className="flex justify-between pt-4">
          <button
            onClick={onPrev}
            className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors"
          >
            上一步
          </button>
          <button
            onClick={onNext}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            下一步
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">配置资源凭证</h3>
        <p className="text-sm text-muted-foreground mb-4">
          根据你选择的功能，需要配置以下资源。你也可以跳过，稍后手动配置。
        </p>
      </div>

      <div className="space-y-6">
        {Array.from(requiredResources).map((resourceType) => {
          const resource = resourceTypes[resourceType];
          if (!resource) return null;

          const isSkipped = skipResources.has(resourceType);

          return (
            <div key={resourceType} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">{resource.name}</h4>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSkipped}
                    onChange={() => toggleSkip(resourceType)}
                    className="w-4 h-4"
                  />
                  <span className="text-muted-foreground">跳过配置</span>
                </label>
              </div>

              {!isSkipped && (
                <div className="grid grid-cols-2 gap-4">
                  {resource.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium mb-1">
                        {field.label}
                        {field.required && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </label>
                      <input
                        type={field.type}
                        value={resourceConfigs[resourceType]?.[field.key] || ''}
                        onChange={(e) =>
                          handleFieldChange(resourceType, field.key, e.target.value)
                        }
                        placeholder={field.default?.toString()}
                        className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {isSkipped && (
                <p className="text-sm text-muted-foreground">
                  将在生成的 .env.example 中包含占位符，需要手动填写
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onPrev}
          className="px-6 py-2 border rounded-md font-medium hover:bg-accent transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}
