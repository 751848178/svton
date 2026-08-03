'use client';

import { Input, Select } from '@/components/ui';
import type { ProjectEnvironment } from '../types';

interface ReleaseCreateFieldsProps {
  environments: ProjectEnvironment[];
  environmentId: string;
  name: string;
  branch: string;
  onEnvironmentChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onBranchChange: (value: string) => void;
}

export function ReleaseCreateFields({
  environments,
  environmentId,
  name,
  branch,
  onEnvironmentChange,
  onNameChange,
  onBranchChange,
}: ReleaseCreateFieldsProps): JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">环境</span>
        <Select
          value={environmentId}
          onChange={(e) => onEnvironmentChange(e.target.value)}
        >
          {environments.map((e) => (
            <option
              key={e.id}
              value={e.id}
            >
              {e.name}
            </option>
          ))}
        </Select>
      </label>
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">发布名称</span>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <span className="block text-xs text-muted-foreground">默认名称使用当前本地时间</span>
      </label>
      <label className="space-y-1">
        <span className="text-xs text-muted-foreground">分支</span>
        <Input
          value={branch}
          onChange={(e) => onBranchChange(e.target.value)}
          placeholder="main / master"
        />
      </label>
    </div>
  );
}
