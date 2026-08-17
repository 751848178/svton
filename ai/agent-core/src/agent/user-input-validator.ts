import type {
  UserInputAnswers,
  UserInputOption,
  UserInputQuestion,
} from './user-input.types';

const MIN_AUTO_RESOLUTION_MS = 60_000;
const MAX_AUTO_RESOLUTION_MS = 240_000;

export function readUserInputQuestions(value: unknown): UserInputQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new Error('User input requires between 1 and 3 questions');
  }
  const questions = value.map(readQuestion);
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error('User input question ids must be unique');
  }
  return questions;
}

export function readAutoResolutionMs(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value) || Number(value) < MIN_AUTO_RESOLUTION_MS
    || Number(value) > MAX_AUTO_RESOLUTION_MS) {
    throw new Error('User input auto resolution must be between 60000 and 240000 ms');
  }
  return Number(value);
}

export function validateUserInputAnswers(
  questions: UserInputQuestion[],
  value: unknown,
): UserInputAnswers {
  if (!isRecord(value)) throw new Error('User input answers must be an object');
  const expectedIds = new Set(questions.map((question) => question.id));
  const receivedIds = Object.keys(value);
  if (receivedIds.length !== questions.length
    || receivedIds.some((id) => !expectedIds.has(id))) {
    throw new Error('User input answers must match every requested question');
  }
  return Object.fromEntries(questions.map((question) => [
    question.id,
    { answers: readQuestionAnswer(question, value[question.id]) },
  ]));
}

function readQuestion(value: unknown): UserInputQuestion {
  if (!isRecord(value)) throw new Error('User input question must be an object');
  const id = readRequiredString(value.id, 'id');
  const header = readRequiredString(value.header, 'header');
  const question = readRequiredString(value.question, 'question');
  if (typeof value.isOther !== 'boolean' || typeof value.isSecret !== 'boolean') {
    throw new Error('User input question flags must be boolean');
  }
  const options = value.options === null || value.options === undefined
    ? null
    : readOptions(value.options);
  return { id, header, question, isOther: value.isOther, isSecret: value.isSecret, options };
}

function readOptions(value: unknown): UserInputOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('User input options must be a non-empty array');
  }
  const options = value.map((option) => {
    if (!isRecord(option)) throw new Error('User input option must be an object');
    return {
      label: readRequiredString(option.label, 'option label'),
      description: readRequiredString(option.description, 'option description'),
    };
  });
  if (new Set(options.map((option) => option.label)).size !== options.length) {
    throw new Error('User input option labels must be unique');
  }
  return options;
}

function readQuestionAnswer(question: UserInputQuestion, value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.answers) || value.answers.length !== 1) {
    throw new Error('Each user input question requires one answer');
  }
  const answer = value.answers[0];
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    throw new Error('Each user input question requires a non-empty answer');
  }
  const normalized = answer.trim();
  if (question.options && !question.options.some((option) => option.label === normalized)
    && !question.isOther) {
    throw new Error('User input answer is not an allowed option');
  }
  return [normalized];
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`User input ${field} must be a non-empty string`);
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
