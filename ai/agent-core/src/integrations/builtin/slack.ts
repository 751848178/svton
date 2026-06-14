/**
 * Slack integration.
 * Provides tools for searching messages and posting to channels via the Slack Web API.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../../tool/types';
import type { IntegrationManifest } from '../types';

const SLACK_API_BASE = 'https://slack.com/api/';

// ============================================================
// slack_search
// ============================================================

const slackSearchDef: ToolDefinition = {
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

class SlackSearchExecutor implements IToolExecutor {
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
        output: `Slack search error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// slack_post_message
// ============================================================

const slackPostMessageDef: ToolDefinition = {
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

class SlackPostMessageExecutor implements IToolExecutor {
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
        output: `Slack post error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }
}

// ============================================================
// Manifest
// ============================================================

export const SlackIntegration: IntegrationManifest = {
  id: 'slack',
  name: 'Slack',
  description:
    'Search and post messages in Slack workspaces. Requires a bot token with appropriate scopes.',
  category: 'comms',
  authType: 'api_key',
  authFields: [
    {
      key: 'botToken',
      label: 'Bot Token (xoxb-...)',
      secret: true,
      placeholder: 'xoxb-XXXXXXXXXXXX-XXXXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX',
    },
  ],
  getTools: (credentials: Record<string, string>) => {
    const getToken = () => credentials.botToken;
    return [
      { definition: slackSearchDef, executor: new SlackSearchExecutor(getToken) },
      { definition: slackPostMessageDef, executor: new SlackPostMessageExecutor(getToken) },
    ];
  },
};
