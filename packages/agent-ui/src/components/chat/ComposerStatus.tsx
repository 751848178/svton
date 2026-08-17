import { useI18n } from '@svton/ui';
import type { ComposerIntentResult } from './composer.types';

export function ComposerStatus({ result, pending }: {
  result: ComposerIntentResult | null;
  pending: boolean;
}) {
  const { translate: t } = useI18n();
  if (pending) {
    return <p role="status" aria-live="polite" className="px-4 pb-2 text-xs text-gray-400">{t('chat.composer.processing')}</p>;
  }
  if (!result || result.kind === 'cancelled' || (!result.message && result.kind === 'succeeded')) return null;
  const failed = result.kind === 'failed' || result.kind === 'busy' || result.kind === 'unsupported';
  return (
    <p
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      data-testid="composer-status"
      className={`px-4 pb-2 text-xs ${failed ? 'text-amber-300' : 'text-emerald-400'}`}
    >
      {result.message}
    </p>
  );
}
