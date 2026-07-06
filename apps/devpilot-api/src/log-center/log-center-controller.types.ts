import { LogStreamSessionRecord } from "./log-stream-session.registry";

export interface AuthRequest {
  user: { id: string };
  teamId: string;
}

export type TailEventRequest = AuthRequest & {
  on?: (event: string, handler: () => void) => void;
};

export type ReadableLogRecord = {
  id: string;
  projectId?: string | null;
  environmentId?: string | null;
  stream?: {
    projectId?: string | null;
    environmentId?: string | null;
  } | null;
};

export type ReadableLogSession = LogStreamSessionRecord;
