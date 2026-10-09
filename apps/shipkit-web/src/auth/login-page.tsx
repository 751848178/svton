'use client';
import { useState } from 'react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import type { AuthSnapshot, LoginInput } from './contracts';

export function LoginPage({ state, onLogin, onRetryLogout }: { state: AuthSnapshot; onLogin: (input: LoginInput) => Promise<void>; onRetryLogout: () => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (state.busy || !username.trim() || !password) return;
    const credentials = { username: username.trim(), password };
    setPassword('');
    void onLogin(credentials);
  };
  return <main className="auth-screen"><section className="auth-card" aria-labelledby="login-title">
    <span className="brand auth-brand"><img src="/mark.svg" alt="" width={32} height={32} />Shipkit</span>
    <header className="auth-heading"><span className="auth-icon"><LockKeyhole size={20} aria-hidden="true" /></span><h1 id="login-title">登录发布工作台</h1><p>使用平台账号管理项目、Agent 与发布任务。</p></header>
    {state.message && <p className="auth-notice" role="status">{state.message}</p>}
    {state.error && <p className="error-message" role="alert" id="login-error">{state.error}</p>}
    {state.logoutFailed && <button type="button" className="button secondary auth-retry" onClick={() => void onRetryLogout()} disabled={state.busy}>重试退出</button>}
    <form className="auth-form" onSubmit={submit} aria-busy={state.busy}>
      <label htmlFor="login-username">账号<input id="login-username" name="username" autoComplete="username" required maxLength={100} value={username} onChange={event => setUsername(event.target.value)} disabled={state.busy} autoFocus /></label>
      <label htmlFor="login-password">密码<input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} disabled={state.busy} aria-describedby={state.error ? 'login-error' : undefined} /></label>
      <button className="button primary auth-submit" type="submit" disabled={state.busy || !username.trim() || !password}>{state.busy ? <><LoaderCircle size={16} aria-hidden="true" />正在处理…</> : '登录'}</button>
    </form>
    <p className="auth-help">账号由平台管理员初始化。如需账号或忘记密码，请联系平台管理员。</p>
  </section></main>;
}
