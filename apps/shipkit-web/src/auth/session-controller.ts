import type { AuthSession, AuthSnapshot, LoginInput } from './contracts';
import { onUnauthorized, retireAuthRequests } from './session-events';

type AuthRequest = (route: 'GET:/auth/session' | 'POST:/auth/login' | 'POST:/auth/logout', input: LoginInput | Record<string, never>) => Promise<unknown>;
const initial: AuthSnapshot = { status: 'checking', busy: false, message: '', error: '', logoutFailed: false, generation: 0 };
const unauthorized = (error: unknown) => (error as { code?: unknown })?.code === 401;

export class SessionController {
  private state = initial;
  private listeners = new Set<() => void>();
  private invalidators = new Set<() => void>();
  private sequence = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private checking?: Promise<void>;
  constructor(private readonly request: AuthRequest) {}
  getSnapshot = () => this.state;
  getServerSnapshot = () => initial;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  onInvalidate = (listener: () => void) => { this.invalidators.add(listener); return () => { this.invalidators.delete(listener); }; };
  private publish(next: Partial<AuthSnapshot>) {
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
  private invalidate(message: string) {
    this.sequence++;
    this.checking = undefined;
    clearTimeout(this.timer);
    retireAuthRequests();
    for (const invalidate of this.invalidators) invalidate();
    this.publish({ status: 'anonymous', session: undefined, busy: false, error: '', message, logoutFailed: false, generation: this.state.generation + 1 });
  }
  private accept(session: AuthSession, fresh = false) {
    const expires = Date.parse(session.expiresAt);
    if (!session.user?.id || !Number.isFinite(expires)) throw new Error('Invalid session');
    if (expires <= Date.now()) { this.invalidate('会话已过期，请重新登录。'); return; }
    const changed = fresh || this.state.session?.user.id !== session.user.id;
    if (changed) {
      retireAuthRequests();
      for (const invalidate of this.invalidators) invalidate();
    }
    clearTimeout(this.timer);
    this.publish({ status: 'authenticated', session, busy: false, error: '', message: '', logoutFailed: false, generation: this.state.generation + (changed ? 1 : 0) });
    this.timer = setTimeout(() => {
      if (Date.parse(this.state.session?.expiresAt || '') <= Date.now()) this.invalidate('会话已过期，请重新登录。');
      else void this.refresh();
    }, Math.min(expires - Date.now(), 2_147_483_647));
  }
  start() {
    const unsubscribe = onUnauthorized(() => this.invalidate('会话已失效，请重新登录。'));
    void this.refresh();
    return () => { unsubscribe(); this.sequence++; this.checking = undefined; clearTimeout(this.timer); };
  }
  refresh = () => {
    if (this.state.busy) return Promise.resolve();
    if (this.checking) return this.checking;
    const sequence = ++this.sequence;
    if (this.state.status !== 'authenticated') this.publish({ status: 'checking', error: '' });
    const checking = (async () => {
      try {
        const session = await this.request('GET:/auth/session', {}) as AuthSession;
        if (sequence === this.sequence) this.accept(session);
      } catch (error) {
        if (sequence !== this.sequence) return;
        if (unauthorized(error)) this.invalidate(this.state.status === 'authenticated' ? '会话已失效，请重新登录。' : '');
        else if (this.state.status !== 'authenticated') this.publish({ status: 'unavailable', error: '暂时无法确认登录状态，请检查连接后重试。' });
      }
    })();
    this.checking = checking;
    void checking.then(() => { if (this.checking === checking) this.checking = undefined; });
    return checking;
  };
  login = async (input: LoginInput) => {
    if (this.state.busy) return;
    const sequence = ++this.sequence;
    retireAuthRequests();
    this.publish({ busy: true, error: '', logoutFailed: false });
    try {
      const session = await this.request('POST:/auth/login', input) as AuthSession;
      if (sequence === this.sequence) this.accept(session, true);
    } catch (error) {
      if (sequence === this.sequence) this.publish({ busy: false, error: unauthorized(error) ? '账号或密码不正确，请重试。' : '暂时无法登录，请稍后重试。' });
    }
  };
  logout = async () => {
    if (this.state.busy) return;
    this.invalidate('已退出登录。');
    const sequence = this.sequence;
    this.publish({ busy: true });
    try {
      await this.request('POST:/auth/logout', {});
      if (sequence === this.sequence) this.publish({ busy: false });
    } catch {
      if (sequence === this.sequence) this.publish({ busy: false, message: '', error: '退出请求未完成，服务器会话可能仍有效，请重试退出。', logoutFailed: true });
    }
  };
}
