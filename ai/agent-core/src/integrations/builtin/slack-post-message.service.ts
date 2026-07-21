import type { ToolAnnotations, ToolDefinition } from '../../provider/types';
import type { IToolExecutor, ToolCall, ToolContext, ToolResult } from '../../tool/types';
import { formatUnknownErrorMessage } from '../../utils/error-message.utils';
import { SLACK_API_BASE } from './slack.constants';

export const slackPostMessageDef: ToolDefinition = {
  name: 'slack_post_message',
  description: 'Post a message to a Slack channel or DM.',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'The channel name (e.g. "general") or channel ID.',
      },
      text: {
        type: 'string',
        description: 'The message text to post.',
      },
    },
    required: ['channel', 'text'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class SlackPostMessageExecutor implements IToolExecutor {
  constructor(private readonly getToken: () => string | undefined) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { channel, text } = call.arguments as {
      channel?: string;
      text?: string;
    };

    if (!channel || typeof channel !== 'string') {
      return { callId: call.id, output: 'Error: "channel" is required and must be a string.', isError: true };
    }
    if (!text || typeof text !== 'string') {
      return { callId: call.id, output: 'Error: "text" is required and must be a string.', isError: true };
    }

    const token = this.getToken();
    if (!token) {
      return {
        callId: call.id,
        output: 'Error: Slack integration is not configured. Missing bearer token.',
        isError: true,
      };
    }

    try {
      const response = await fetch(`${SLACK_API_BASE}chat.postMessage`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({ channel, text }),
      });

      const data = await response.json() as any;

      if (!data.ok) {
        return {
          callId: call.id,
          output: `Slack API error: ${data.error || 'unknown error'}`,
          isError: true,
        };
      }

      return {
        callId: call.id,
        output: `Message posted to ${data.channel ?? channel} at ts ${data.ts ?? ''}.`,
        metadata: { channel: data.channel, ts: data.ts },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Slack post error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
      };
    }
  }
}
