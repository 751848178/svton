'use client';
import { useEffect, useState } from 'react';
import { SWRConfig } from 'swr';
import { LoaderCircle } from 'lucide-react';
import type { AuthenticatedProps } from './contracts';
import type { SessionController } from './session-controller';
import { SessionCache } from './session-cache';
import { useAuthSession } from './use-auth-session';
import { LoginPage } from './login-page';

function SessionBoundary({ controller, children }: { controller: SessionController; children: React.ReactNode }) {
  const [cache] = useState(() => new SessionCache());
  useEffect(() => {
    const unsubscribe = controller.onInvalidate(() => cache.retire());
    return () => { unsubscribe(); cache.retire(); };
  }, [controller, cache]);
  return <SWRConfig value={{ provider: () => cache, shouldRetryOnError: error => error?.code !== 401 }}>{children}</SWRConfig>;
}
export function AuthGate({ children }: { children: (auth: AuthenticatedProps) => React.ReactNode }) {
  const { state, controller } = useAuthSession();
  if (state.status === 'authenticated' && state.session) return <SessionBoundary key={state.generation} controller={controller}>
    {children({ user: state.session.user, onLogout: () => { void controller.logout(); } })}
  </SessionBoundary>;
  if (state.status === 'anonymous') return <LoginPage state={state} onLogin={controller.login} onRetryLogout={controller.logout} />;
  return <main className="auth-screen"><section className="auth-card auth-connection" aria-live="polite">
    <span className="brand auth-brand"><img src="/mark.svg" alt="" width={32} height={32} />Shipkit</span>
    {state.status === 'checking' ? <p className="auth-loading" role="status"><LoaderCircle size={18} aria-hidden="true" />正在确认登录状态…</p>
      : <><p className="error-message" role="alert">{state.error}</p><button className="button primary" onClick={() => void controller.refresh()}>重试连接</button></>}
  </section></main>;
}
