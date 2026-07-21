import type { ToolAnnotations, ToolDefinition } from '../../provider/types';
import type { IToolExecutor, ToolCall, ToolContext, ToolResult } from '../../tool/types';
import { formatUnknownErrorMessage } from '../../utils/error-message.utils';
import { LINEAR_GRAPHQL_URL } from './linear.constants';
import { escapeLinearGql } from './linear-gql.utils';

export const linearListIssuesDef: ToolDefinition = {
  name: 'linear_list_issues',
  description:
    'List Linear issues with optional filters by team, status, or assignee.',
  parameters: {
    type: 'object',
    properties: {
      teamId: {
        type: 'string',
        description: 'Optional team ID to filter issues by.',
      },
      status: {
        type: 'string',
        description: 'Optional status name filter (e.g. "In Progress", "Backlog").',
      },
      assignee: {
        type: 'string',
        description: 'Optional assignee email or user ID.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return. Default: 50.',
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class LinearListIssuesExecutor implements IToolExecutor {
  constructor(private readonly getApiKey: () => string | undefined) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { teamId, status, assignee, limit } = call.arguments as {
      teamId?: string;
      status?: string;
      assignee?: string;
      limit?: number;
    };

    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        callId: call.id,
        output: 'Error: Linear integration is not configured. Missing API key.',
        isError: true,
      };
    }

    try {
      const queryLimit = limit ?? 50;
      const filterClauses: string[] = [];

      if (teamId) {
        filterClauses.push(`team: { id: { eq: "${escapeLinearGql(teamId)}" } }`);
      }
      if (status) {
        filterClauses.push(`state: { name: { eq: "${escapeLinearGql(status)}" } }`);
      }
      if (assignee) {
        filterClauses.push(`assignee: { id: { eq: "${escapeLinearGql(assignee)}" } }`);
      }

      const filterArg = filterClauses.length > 0
        ? `, filter: { ${filterClauses.join(', ')} }`
        : '';

      const graphqlQuery = `query {
        issues(first: ${queryLimit}${filterArg}) {
          nodes {
            id
            identifier
            title
            description
            priority
            state { name }
            team { id name }
            assignee { id name email }
            createdAt
          }
        }
      }`;

      const data = await this.callLinear(apiKey, graphqlQuery);

      if (data.errors) {
        return {
          callId: call.id,
          output: `Linear GraphQL errors: ${JSON.stringify(data.errors)}`,
          isError: true,
        };
      }

      const nodes = data?.data?.issues?.nodes ?? [];
      const results = nodes.map((n: any) => ({
        id: n.id,
        identifier: n.identifier,
        title: n.title,
        description: n.description ?? '',
        priority: n.priority,
        state: n.state?.name ?? '',
        team: n.team?.name ?? '',
        assignee: n.assignee?.name ?? '',
        assigneeEmail: n.assignee?.email ?? '',
        createdAt: n.createdAt ?? '',
      }));

      const output =
        results.length === 0
          ? 'No issues found.'
          : results
              .map(
                (r: any) =>
                  `${r.identifier} — ${r.title} [${r.state}] (priority=${r.priority}, team=${r.team}, assignee=${r.assignee || 'unassigned'})`,
              )
              .join('\n');

      return {
        callId: call.id,
        output,
        metadata: { results, total: results.length },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `Linear list issues error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
      };
    }
  }

  private async callLinear(apiKey: string, query: string): Promise<any> {
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    return response.json();
  }
}
