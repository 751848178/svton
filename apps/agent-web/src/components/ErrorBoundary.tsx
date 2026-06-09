'use client';

import React, { useState, useCallback, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Functional error boundary wrapper.
 * Uses key-based remount to recover from errors.
 */
export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryKey((k) => k + 1);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-red-100 p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorCatcher key={retryKey} onError={setError}>
      {children}
    </ErrorCatcher>
  );
}

/**
 * Internal class component that catches render errors.
 */
class ErrorCatcher extends React.Component<{ children: ReactNode; onError: (error: Error) => void }> {
  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.props.children;
  }
}
