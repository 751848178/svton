'use client';

/**
 * 执行策略 — 页面内嵌帮助
 *
 * 对标 twgg 的 PageHelpButton：右上角「使用说明」按钮 + Modal，
 * 内嵌 DocsViewer（复用平台文档中心的「执行策略」一文）。
 *
 * 弹窗顶部加一句一句话引导（quickHelpSummary），点破 issue 里的误解：
 * 「执行策略 = 命令白/黑名单，决定命令能不能跑，不决定是否排队」。
 *
 * 单一职责：在 execution-policies 页提供帮助入口 + 弹窗。
 */

import { useBoolean } from '@svton/hooks';
import { useTranslations } from 'next-intl';
import { Button, Modal } from '@/components/ui';
import { DocsViewer } from '@/features/docs/docs-viewer';

const DOC_ID = 'execution-policies';

export interface PolicyHelpProps {
  /** 触发按钮文案的展示形态：'button'（默认，PageHeader 用）/ 'link'（空状态用）。 */
  trigger?: 'button' | 'link';
  className?: string;
}

export function PolicyHelp({ trigger = 'button', className }: PolicyHelpProps) {
  const t = useTranslations('executionPolicies');
  const [open, { setTrue: openModal, setFalse: closeModal }] = useBoolean(false);

  return (
    <>
      {trigger === 'link' ? (
        <button
          type="button"
          onClick={openModal}
          className={`text-sm text-primary underline-offset-4 hover:underline ${className ?? ''}`}
        >
          {t('learnMore')}
        </button>
      ) : (
        <Button variant="outline" onClick={openModal} className={className}>
          {t('docsButton')}
        </Button>
      )}
      <Modal
        open={open}
        onClose={closeModal}
        title={t('pageTitle')}
        width={760}
      >
        <div className="space-y-4">
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground/90">
            {t('quickHelpSummary')}
          </p>
          <DocsViewer documentId={DOC_ID} compact />
        </div>
      </Modal>
    </>
  );
}
