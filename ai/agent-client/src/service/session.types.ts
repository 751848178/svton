export interface SessionInfo {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}

export interface SessionData {
  id: string;
  title: string;
  model: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
  projectId?: string;
}
