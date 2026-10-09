export interface SessionView {
  user: { id: string; username: string; displayName: string };
  expiresAt: string;
}
export interface AuthenticatedRequest { sessionHash: string; view: SessionView }
