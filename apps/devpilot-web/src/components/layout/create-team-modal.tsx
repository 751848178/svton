'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';

/**
 * 创建团队表单弹窗。从 team-switcher 拆出,使 team-switcher 只负责切换器交互,
 * 本文件只负责「创建团队」表单的展示与提交回调(无业务规则,数据写入回传调用方)。
 */
export interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  teamName: string;
  setTeamName: (name: string) => void;
  creating: boolean;
}

export function CreateTeamModal({
  open,
  onClose,
  onSubmit,
  teamName,
  setTeamName,
  creating,
}: CreateTeamModalProps) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('createNewTeam')}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('teamName')}</span>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder={t('teamNamePlaceholder')}
            className="min-h-11 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {tc('cancel')}
          </button>
          <button
            type="submit"
            disabled={creating || !teamName.trim()}
            className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? t('creating') : tc('create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
