import type { ToolAnnotations, ToolDefinition } from '../../provider/types';
import type { IToolExecutor, ToolCall, ToolContext, ToolResult } from '../../tool/types';
import { formatUnknownErrorMessage } from '../../utils/error-message.utils';
import { SLACK_API_BASE } from './slack.constants';

export const slackSearchDef: ToolDefinition = {
  name: 'slack_search',
  description:
    'Search messages in Slack. Returns matching messages with channel, author, timestamp, and text.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query.',
      },
      count: {
        type: 'number',
        description: 'Maximum number of results to return. Default: 20.',
      },
      channel: {
        type: 'string',
        description: 'Optional channel to scope the search to (e.g. "general").',
      },
    },
    required: ['query'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class SlackSearchExecutor implements IToolExecutor {
  constructor(private readonly getToken: () => string | undefined) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { query, count, channel } = call.arguments as {
      query?: string;
      count?: number;
      channel?: string;
    };

    if (!query || typeof query !== 'string') {
      return { callId: call.id, output: 'Error: "query" is required and must be a string.', isError: true };
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
      let searchQuery = query;
      if (channel) {
        searchQuery = `in:#${channel} ${query}`;
      }

      const params = new URLSearchParams({
        query: searchQuery,
        count: String(count ?? 20),
      });

      const response = await fetch(`${SLACK_API_BASE}search.messages?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json() as any;

      if (!data.ok) {
        return {
          callId: call.id,
          output: `Slack API error: ${data.error || 'unknown error'}`,
          isError: true,
        };
      }

      const matches = data?.messages?.matches ?? [];
      const results = matches.map((m: any) => ({
        channel: m.channel?.name ?? m.channel?.id ?? '',
        user: m.user ?? '',
        username: m.username ?? '',
        timestamp: m.ts ?? '',
        text: m.text ?? '',
        permalink: m.permalink ?? '',
      }));

      const output =
        results.length === 0
          ? 'No messages found.'
          : results
              .map(
                (r: any) =>
                  `[${r.channel}] ${r.username || r.user} (${r.timestamp}): ${r.text}`,
              )
              .join('\n');

      return {
        callId: call.id,
        output,
        metadata: { results, total: data?.messages?.total ?? results.length },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Slack search error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
      };
    }
  }
}
