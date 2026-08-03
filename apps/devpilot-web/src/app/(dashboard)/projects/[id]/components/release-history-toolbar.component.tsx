/**
 * 发布历史工具栏。
 *
 * 单一职责：提供可访问的计划搜索、状态筛选、选择、刷新和新建入口。
 */
'use client';

import { useMemo, useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { PLAN_STATUS_LABEL, pickLabel } from '../utils/release-labels';
import type { ReleasePlan } from '../types/releases';

export interface ReleaseHistoryToolbarProps {
  plans: ReleasePlan[];
  selectedPlanId: string;
  loading: boolean;
  createDisabled: boolean;
  onSelect: (planId: string) => void;
  onReload: () => void;
  onCreate: () => void;
}

export function ReleaseHistoryToolbar({
  plans,
  selectedPlanId,
  loading,
  createDisabled,
  onSelect,
  onReload,
  onCreate,
}: ReleaseHistoryToolbarProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const visiblePlans = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return plans.filter((plan) => {
      if (plan.id === selectedPlanId) return true;
      if (status !== 'all' && plan.status !== status) return false;
      return !normalized || plan.name.toLowerCase().includes(normalized);
    });
  }, [plans, query, selectedPlanId, status]);

  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-52 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">搜索发布历史</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入发布名称"
          />
        </label>
        <label className="w-32 space-y-1">
          <span className="text-xs text-muted-foreground">状态</span>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">全部</option>
            {Object.entries(PLAN_STATUS_LABEL).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="outline"
          onClick={onReload}
          loading={loading}
        >
          刷新
        </Button>
        <Button
          onClick={onCreate}
          disabled={createDisabled}
        >
          新建发布
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">当前发布计划</span>
        <Select
          value={selectedPlanId}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">请选择发布计划</option>
          {visiblePlans.map((plan) => (
            <option
              key={plan.id}
              value={plan.id}
            >
              {plan.name} · {pickLabel(PLAN_STATUS_LABEL, plan.status)} ·{' '}
              {formatDateTimeMinute(plan.createdAt)}
            </option>
          ))}
        </Select>
      </label>
      {visiblePlans.length === 0 && (
        <p className="text-xs text-muted-foreground">没有符合条件的发布记录</p>
      )}
    </div>
  );
}
