export interface UserInputOption {
  label: string;
  description: string;
}

export interface UserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: UserInputOption[] | null;
}

export type UserInputAnswers = Record<string, { answers: string[] }>;

export interface UserInputRequest {
  sessionId: string;
  requestId: string;
  questions: UserInputQuestion[];
  autoResolutionMs?: number;
}

export type UserInputSettlement = 'resolved' | 'interrupted' | 'timed_out';

export type UserInputRequester = (
  requestId: string,
  questions: UserInputQuestion[],
  autoResolutionMs?: number,
) => Promise<UserInputAnswers>;
