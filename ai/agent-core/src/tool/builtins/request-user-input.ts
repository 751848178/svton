import type { IToolExecutor, SvtonToolDefinition, ToolCall, ToolContext, ToolResult } from '../types';
import { readAutoResolutionMs, readUserInputQuestions } from '../../agent/user-input-validator';

export const requestUserInputDef: SvtonToolDefinition = {
  name: 'request_user_input',
  label: 'Ask user a question',
  description: 'Pause this run and ask the user one to three structured questions.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array', minItems: 1, maxItems: 3,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' }, header: { type: 'string' }, question: { type: 'string' },
            isOther: { type: 'boolean' }, isSecret: { type: 'boolean' },
            options: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'array', minItems: 1,
                  items: {
                    type: 'object',
                    properties: { label: { type: 'string' }, description: { type: 'string' } },
                    required: ['label', 'description'], additionalProperties: false,
                  },
                },
              ],
            },
          },
          required: ['id', 'header', 'question', 'isOther', 'isSecret', 'options'],
          additionalProperties: false,
        },
      },
      autoResolutionMs: {
        anyOf: [{ type: 'null' }, { type: 'integer', minimum: 60000, maximum: 240000 }],
      },
    },
    required: ['questions'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, idempotentHint: true },
};

export class RequestUserInputExecutor implements IToolExecutor {
  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    if (!context.requestUserInput) throw new Error('Structured user input is unavailable');
    const questions = readUserInputQuestions(call.arguments.questions);
    const autoResolutionMs = readAutoResolutionMs(call.arguments.autoResolutionMs);
    const answers = await context.requestUserInput(call.id, questions, autoResolutionMs);
    const secretQuestionIds = questions.filter((question) => question.isSecret).map((question) => question.id);
    return {
      callId: call.id,
      output: JSON.stringify({ answers }),
      metadata: {
        structuredUserInput: true,
        containsSecret: secretQuestionIds.length > 0,
        secretQuestionIds,
      },
    };
  }
}
