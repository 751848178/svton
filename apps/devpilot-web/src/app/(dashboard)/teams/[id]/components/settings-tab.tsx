/**
 * 团队设置 Tab
 *
 * 单一职责：渲染团队名称/描述编辑表单 + 独立分区的危险操作（删除团队）。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Button, Input, Textarea } from '@/components/ui';

interface SettingsTabProps {
  editName: string;
  editDesc: string;
  canEditSettings: boolean;
  saving: boolean;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete: () => void;
}

export function SettingsTab({
  editName,
  editDesc,
  canEditSettings,
  saving,
  onNameChange,
  onDescChange,
  onSubmit,
  onDelete,
}: SettingsTabProps) {
  const t = useTranslations('teams');
  const tc = useTranslations('common');

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('teamName')}</span>
          <Input
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={!canEditSettings}
            className="max-w-md"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{tc('description')}</span>
          <Textarea
            value={editDesc}
            onChange={(e) => onDescChange(e.target.value)}
            disabled={!canEditSettings}
            rows={3}
            className="max-w-md resize-none"
          />
        </label>
        {canEditSettings ? (
          <Button
            type="submit"
            disabled={saving || !editName.trim()}
          >
            {saving ? t('saving') : t('saveChanges')}
          </Button>
        ) : null}
      </form>

      {canEditSettings ? (
        <div className="rounded-lg border border-destructive/30 p-4">
          <h3 className="mb-2 text-lg font-medium text-destructive">{t('dangerZoneTitle')}</h3>
          <p className="mb-4 text-sm text-muted-foreground">{t('deleteTeamWarning')}</p>
          <Button
            variant="destructive"
            onClick={onDelete}
          >
            {t('deleteTeam')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
