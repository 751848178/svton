import type {
  SessionActivityViewModel,
  SessionManagementController,
  SessionManagementViewModel,
  SessionSearchResult,
} from '@svton/agent-client';
import type { SessionSearchModel } from '@svton/agent-ui';

export interface DesktopSessionSearchProps {
  open: boolean;
  results: SessionSearchResult[];
  activityBySessionId: ReadonlyMap<string, SessionActivityViewModel>;
  managementBySessionId: ReadonlyMap<string, SessionManagementViewModel>;
  managementActions: SessionManagementController;
  search: SessionSearchModel;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export interface DesktopSessionSearchOptionModel {
  result: SessionSearchResult;
  archived: boolean;
  selected: boolean;
  optionId: string;
}
