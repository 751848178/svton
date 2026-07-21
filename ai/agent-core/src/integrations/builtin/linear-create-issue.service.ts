import type { ToolAnnotations, ToolDefinition } from '../../provider/types';
import type { IToolExecutor, ToolCall, ToolContext, ToolResult } from '../../tool/types';
import { formatUnknownErrorMessage } from '../../utils/error-message.utils';
import { LINEAR_GRAPHQL_URL } from './linear.constants';
import { escapeLinearGql } from './linear-gql.utils';

export const linearCreateIssueDef: ToolDefinition = {
  name: 'linear_create_issue',
  description: 'Create a new Linear issue in a team.',
  parameters: {
    type: 'object',
    properties: {
      teamId: {
        type: 'string',
        description: 'The Linear team ID to create the issue in.',
      },
      title: {
        type: 'string',
        description: 'The title of the issue.',
      },
      description: {
        type: 'string',
        description: 'Optional description (markdown supported).',
      },
      priority: {
        type: 'number',
        description: 'Optional priority level (0-4). 0 = Urgent, 1 = High, 2 = Normal, 3 = Low.',
      },
    },
    required: ['teamId', 'title'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class LinearCreateIssueExecutor implements IToolExecutor {
  constructor(private readonly getApiKey: () => string | undefined) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { teamId, title, description, priority } = call.arguments as {
      teamId?: string;
      title?: string;
      description?: string;
      priority?: number;
    };

    if (!teamId || typeof teamId !== 'string') {
      return { callId: call.id, output: 'Error: "teamId" is required and must be a string.', isError: true };
    }
    if (!title || typeof title !== 'string') {
      return { callId: call.id, output: 'Error: "title" is required and must be a string.', isError: true };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        callId: call.id,
        output: 'Error: Linear integration is not configured. Missing API key.',
        isError: true,
      };
    }

    try {
      const mutation = `mutation {
        issueCreate(
          input: {
            teamId: "${escapeLinearGql(teamId)}"
            title: "${escapeLinearGql(title)}"
            ${description ? `description: "${escapeLinearGql(description)}"` : ''}
            ${priority !== undefined ? `priority: ${Number(priority)}` : ''}
          }
        ) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }`;

      const response = await fetch(LINEAR_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: mutation }),
      });

      const data = await response.json() as any;

      if (data.errors) {
        return {
          callId: call.id,
          output: `Linear GraphQL errors: ${JSON.stringify(data.errors)}`,
          isError: true,
        };
      }

      const issue = data?.data?.issueCreate?.issue;
      if (!issue) {
        return {
          callId: call.id,
          output: 'Issue creation returned no issue data.',
          isError: true,
        };
      }

      return {
        callId: call.id,
        output: `Created issue ${issue.identifier} — ${issue.title}. URL: ${issue.url ?? 'n/a'}`,
        metadata: { issue },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Linear create issue error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
      };
    }
  }
}
