import { EmptyState, LoadingState } from '@svton/ui';
import { useTranslations } from 'next-intl';
import { ErrorBanner, LinkButton } from '@/components/ui';

interface EnvironmentVersionsRequestStateProps {
  projectId: string;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

export function EnvironmentVersionsRequestState({
  projectId,
  loading,
  error,
  onRetry,
}: EnvironmentVersionsRequestStateProps) {
  const t = useTranslations('projects');
  if (loading) {
    return (
      <LoadingState
        text={t('environmentVersionsLoading')}
        className="min-h-48 rounded-lg border"
      />
    );
  }
  if (error) {
    return (
      <ErrorBanner
        message={error}
        onRetry={onRetry}
        retryLabel={t('environmentVersionsRetry')}
      />
    );
  }
  return (
    <EmptyState
      text={t('environmentVersionsEmptyTitle')}
      description={t('environmentVersionsEmptyDescription')}
      className="min-h-48 rounded-lg border"
      action={
        <LinkButton
          href={`/projects/${encodeURIComponent(projectId)}/settings?section=environments`}
          variant="outline"
        >
          {t('manageEnvironmentConfiguration')}
        </LinkButton>
      }
    />
  );
}
