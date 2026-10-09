export interface AuthUser { id: string; username: string; displayName: string }
export interface AuthSession { user: AuthUser; expiresAt: string }
export interface LoginInput { username: string; password: string }
export interface AuthenticatedProps { user: AuthUser; onLogout: () => void }
export interface AuthSnapshot {
  status: 'checking' | 'anonymous' | 'authenticated' | 'unavailable';
  session?: AuthSession;
  busy: boolean;
  message: string;
  error: string;
  logoutFailed: boolean;
  generation: number;
}
