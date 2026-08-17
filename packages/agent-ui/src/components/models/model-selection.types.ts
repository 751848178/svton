export type ModelSelectionPhase =
  | 'idle'
  | 'preparing'
  | 'committing'
  | 'succeeded'
  | 'failed';

export interface ModelSelectionOption {
  value: string;
  modelName: string;
  providerName: string;
  providerId: string;
  accessibleName: string;
  hiddenCurrent: boolean;
  removedCurrent: boolean;
  bootstrap: boolean;
}

export interface ModelSelectionControl {
  options: readonly ModelSelectionOption[];
  activeValue: string;
  persistedValue: string;
  pendingValue?: string;
  phase: ModelSelectionPhase;
  message?: string;
  disabledReason?: string;
  activeLabel: string;
  persistedLabel: string;
  canRetryPersistence: boolean;
  select: (value: string) => void | Promise<void>;
  retryPersistence: () => void | Promise<void>;
  dismissResult: () => void;
}
