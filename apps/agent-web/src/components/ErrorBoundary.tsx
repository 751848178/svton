'use client';

import React, { useState, useCallback, type ReactNode } from 'react';
import { Button, ErrorState, useI18n } from '@svton/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Functional error boundary wrapper.
 * Uses key-based remount to recover from errors.
 */
export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const { translate: t } = useI18n();
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setRetryKey((k) => k + 1);
  }, []);

  if (hasError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <ErrorState
          className="w-full max-w-md rounded-lg border border-border bg-card shadow-sm"
          title={t('tool.error')}
          message={t('chat.announcement.failed')}
          action={<Button type="button" onClick={handleRetry}>{t('action.retry')}</Button>}
        />
      </div>
    );
  }

  return (
    <ErrorCatcher key={retryKey} onError={() => setHasError(true)}>
      {children}
    </ErrorCatcher>
  );
}

/**
 * Internal class component that catches render errors.
 */
class ErrorCatcher extends React.Component<{ children: ReactNode; onError: () => void }> {
  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.props.children;
  }
}
