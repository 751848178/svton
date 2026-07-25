/**
 * 交付字段值展示（脱敏）。
 *
 * 单一职责：把 resource-instance 的 delivery 字段渲染为键值对，对齐 /keys 页
 * reveal-on-click 脱敏基线。敏感字段名默认显示掩码，点击「显示」切换明文 + 复制。
 *
 * 设计要点：
 *  - 仅按 key 名脱敏（SENSITIVE_KEY_RE），避免误伤 host/port/database 等连接元数据；
 *  - 对象/数组递归渲染每个叶子，嵌套的敏感键同样脱敏；
 *  - 复合键 `${instanceId}:${fieldPath}` 保证同名字段在不同实例/层级互不串扰。
 */
'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Copyable } from '@svton/ui';

/** 敏感字段名命中正则：password / secret / token / credential / apikey / privatekey。 */
const SENSITIVE_KEY_RE = /password|secret|token|credential|apikey|privatekey/i;

export type RevealState = Record<string, string>;
export type RevealSetter = (patch: Partial<RevealState>) => void;

export interface DeliveryValueProps {
  fieldKey: string;
  instanceId: string;
  value: unknown;
  revealed: RevealState;
  setRevealed: RevealSetter;
}

/**
 * 交付字段值：空值显示「-」，对象/数组递归到叶子，叶子按 key 名判断是否脱敏。
 */
export function DeliveryValue({ fieldKey, instanceId, value, revealed, setRevealed }: DeliveryValueProps) {
  if (value === null || value === undefined) {
    return <span className="font-mono">-</span>;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="font-mono">{'{}'}</span>;
    }
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <DeliveryValue
            key={k}
            fieldKey={`${fieldKey}.${k}`}
            instanceId={instanceId}
            value={v}
            revealed={revealed}
            setRevealed={setRevealed}
          />
        ))}
      </div>
    );
  }
  if (!SENSITIVE_KEY_RE.test(fieldKey)) {
    return <span className="break-all font-mono">{String(value)}</span>;
  }
  return (
    <SensitiveLeaf
      fieldKey={fieldKey}
      instanceId={instanceId}
      text={String(value)}
      revealed={revealed}
      setRevealed={setRevealed}
    />
  );
}

/**
 * 敏感叶子值：默认 ••••••••，点击「显示」切换为明文 + 复制按钮（Copyable）。
 */
function SensitiveLeaf({
  fieldKey,
  instanceId,
  text,
  revealed,
  setRevealed,
}: {
  fieldKey: string;
  instanceId: string;
  text: string;
  revealed: RevealState;
  setRevealed: RevealSetter;
}) {
  const t = useTranslations('resourceInstances');
  const compositeKey = `${instanceId}:${fieldKey}`;
  const isRevealed = Boolean(revealed[compositeKey]);
  const toggle = usePersistFn(() => {
    setRevealed({ [compositeKey]: isRevealed ? '' : text });
  });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {isRevealed ? (
        <Copyable text={text} copyText={t('copy')} copiedText={t('copied')}>
          <code className="block break-all font-mono">{text}</code>
        </Copyable>
      ) : (
        <code className="font-mono">{t('maskedValue')}</code>
      )}
      <button
        type="button"
        onClick={toggle}
        className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10"
      >
        {isRevealed ? t('hide') : t('reveal')}
      </button>
    </span>
  );
}
