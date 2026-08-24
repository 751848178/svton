'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Checkbox, Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui';
import type { ProjectDirectoryItem } from '../types';
import {
  directoryEnvColumns,
  DIRECTORY_VISIBLE_ENV_COLUMNS_KEY,
  parseVisibleEnvColumns,
  resolveVisibleEnvColumns,
} from './project-directory-columns.model';
import { ProjectDirectoryRow } from './project-card';

export function ProjectDirectoryPanel({
  items,
  validating,
  empty,
}: {
  items: ProjectDirectoryItem[];
  validating: boolean;
  empty?: ReactNode;
}) {
  const t = useTranslations('projects');
  // 动态环境列：默认全部隐藏（出厂态=仅静态列），用户在「配置」里勾选要显示的环境列。
  const allEnvColumns = useMemo(() => directoryEnvColumns(items), [items]);
  const [visibleKeys, setVisibleKeys] = useState<string[] | null>(null);

  useEffect(() => {
    setVisibleKeys(
      parseVisibleEnvColumns(window.localStorage.getItem(DIRECTORY_VISIBLE_ENV_COLUMNS_KEY)),
    );
  }, []);

  const persist = (next: string[]) => {
    setVisibleKeys(next);
    window.localStorage.setItem(DIRECTORY_VISIBLE_ENV_COLUMNS_KEY, JSON.stringify(next));
  };

  const visibleEnvColumns = useMemo(
    () => resolveVisibleEnvColumns(allEnvColumns, visibleKeys),
    [allEnvColumns, visibleKeys],
  );

  return (
    <div aria-busy={validating}>
      {allEnvColumns.length > 0 ? (
        <div className="flex justify-end px-4 pt-3">
          <ColumnSettingsPopover
            allEnvColumns={allEnvColumns}
            visibleKeys={visibleKeys ?? []}
            onChange={persist}
          />
        </div>
      ) : null}
      {/* @svton/ui Table 原语（结构+基线样式），列规范经 className 组合表达。 */}
      <Table className="min-w-[900px] text-left">
        <TableHeader className="bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <TableRow>
            <TableHead className="w-72 px-4 py-3">{t('directoryProject')}</TableHead>
            <TableHead className="w-24 px-4 py-3">{t('directoryStatus')}</TableHead>
            <TableHead className="w-[8.5rem] px-4 py-3">{t('directoryComponents')}</TableHead>
            <TableHead className="px-4 py-3">{t('directoryLiveVersion')}</TableHead>
            <TableHead className="px-4 py-3">{t('directoryLatestRelease')}</TableHead>
            {visibleEnvColumns.map((column) => (
              <TableHead
                key={column.key}
                className="px-4 py-3"
              >
                {column.name}
              </TableHead>
            ))}
            <TableHead className="px-4 py-3 text-right">{t('directoryActions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {items.length > 0
            ? items.map((project) => (
                <ProjectDirectoryRow
                  key={project.id}
                  project={project}
                  envColumns={visibleEnvColumns}
                />
              ))
            : empty && (
                <TableRow>
                  <td
                    colSpan={6 + visibleEnvColumns.length}
                    className="px-4 py-10"
                  >
                    {empty}
                  </td>
                </TableRow>
              )}
        </TableBody>
      </Table>
    </div>
  );
}

/** 「配置」：链接触发 + popover（Checkbox 勾选=显示该环境列；点外/Esc 收起）。 */
function ColumnSettingsPopover({
  allEnvColumns,
  visibleKeys,
  onChange,
}: {
  allEnvColumns: Array<{ key: string; name: string }>;
  visibleKeys: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (key: string) => {
    const next = visibleKeys.includes(key)
      ? visibleKeys.filter((item) => item !== key)
      : [...visibleKeys, key];
    onChange(next);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
      >
        <SlidersHorizontal
          size={14}
          aria-hidden="true"
        />
        {t('directoryColumnSettings')}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('directoryColumnSettings')}
          className="absolute right-0 z-50 mt-1 w-60 rounded-md border bg-popover p-1 shadow-md"
        >
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">
            {t('directoryColumnSettingsEnvTitle')}
          </p>
          <div className="max-h-72 space-y-0.5 overflow-y-auto px-1 py-1">
            {allEnvColumns.map((column) => (
              <div
                key={column.key}
                className="rounded px-1 py-0.5 hover:bg-accent"
              >
                <Checkbox
                  checked={visibleKeys.includes(column.key)}
                  onChange={() => toggle(column.key)}
                  label={column.name}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t px-2 py-1.5">
            <button
              type="button"
              onClick={() => onChange(allEnvColumns.map((column) => column.key))}
              className="rounded px-1 text-xs text-primary hover:underline"
            >
              {t('directoryColumnShowAll')}
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded px-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              {t('directoryColumnResetDefault')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
