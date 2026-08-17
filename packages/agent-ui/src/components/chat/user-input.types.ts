export interface UserInputOptionView {
  label: string;
  description: string;
}

export interface UserInputQuestionView {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: UserInputOptionView[] | null;
}

export type UserInputAnswerPayload = Record<string, { answers: string[] }>;

export interface UserInputRequestView {
  sessionId: string;
  requestId: string;
  questions: UserInputQuestionView[];
  autoResolutionMs?: number;
  state: 'pending' | 'submitting' | 'error';
  error?: string;
  draft?: Record<string, string>;
}
