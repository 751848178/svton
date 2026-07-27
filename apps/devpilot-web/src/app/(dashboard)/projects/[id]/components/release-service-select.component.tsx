/**
 * 发布服务多选（F383, invest-3 §A.4）
 *
 * 单一职责：按目标环境过滤后的应用服务复选列表。
 * 当 environmentId 变化时，调用方负责清空 selectedServices（见 wizard 的失效预览 effect）。
 */
'use client';

import type { ProjectApplication } from '../types/index';

export interface ReleaseServiceSelectProps {
  applications: ProjectApplication[];
  environmentId: string;
  environmentName: string;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

interface VisibleService {
  appId: string;
  appName: string;
  svcId: string;
  svcName: string;
  serverName?: string;
}

export function ReleaseServiceSelect({
  applications,
  environmentId,
  environmentName,
  selected,
  onChange,
}: ReleaseServiceSelectProps): JSX.Element {
  const visible: VisibleService[] = [];
  for (const app of applications) {
    for (const svc of app.services ?? []) {
      if (svc.environment?.id === environmentId) {
        visible.push({
          appId: app.id,
          appName: app.name,
          svcId: svc.id,
          svcName: svc.name,
          serverName: svc.server?.name,
        });
      }
    }
  }

  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">
        选择应用服务（仅目标环境：{environmentName || '-'}）
      </div>
      <div className="max-h-60 space-y-2 overflow-auto">
        {visible.length === 0 && (
          <div className="text-xs text-muted-foreground">该环境下暂无应用服务</div>
        )}
        {visible.map((s) => (
          <label key={s.svcId} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(s.svcId)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(s.svcId);
                else next.delete(s.svcId);
                onChange(next);
              }}
            />
            <span>
              {s.appName} / {s.svcName}
            </span>
            {s.serverName && (
              <span className="text-xs text-muted-foreground">（{s.serverName}）</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
