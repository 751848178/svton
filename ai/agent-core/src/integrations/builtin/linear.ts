/**
 * Linear integration.
 * Provides tools for listing and creating issues via the Linear GraphQL API.
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../../tool/types';
import type { IntegrationManifest } from '../types';

const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

// ============================================================
// linear_list_issues
// ============================================================

const linearListIssuesDef: ToolDefinition = {
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

class LinearListIssuesExecutor implements IToolExecutor {
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

      // Build the GraphQL query with filters
      const filterClauses: string[] = [];

      if (teamId) {
        filterClauses.push(`team: { id: { eq: "${this.escapeGql(teamId)}" } }`);
      }
      if (status) {
        filterClauses.push(`state: { name: { eq: "${this.escapeGql(status)}" } }`);
      }
      if (assignee) {
        filterClauses.push(`assignee: { id: { eq: "${this.escapeGql(assignee)}" } }`);
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
        output: `Linear list issues error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  private escapeGql(s: string): string {
    return s.replace(/["\\\n\r]/g, (c) => {
      switch (c) {
        case '"': return '\\"';
        case '\\': return '\\\\';
        case '\n': return '\\n';
        case '\r': return '\\r';
        default: return c;
      }
    });
  }

  protected async callLinear(apiKey: string, query: string): Promise<any> {
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

// ============================================================
// linear_create_issue
// ============================================================

const linearCreateIssueDef: ToolDefinition = {
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

class LinearCreateIssueExecutor implements IToolExecutor {
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
            teamId: "${this.escapeGql(teamId)}"
            title: "${this.escapeGql(title)}"
            ${description ? `description: "${this.escapeGql(description)}"` : ''}
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
        output: `Linear create issue error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  private escapeGql(s: string): string {
    return s.replace(/["\\\n\r]/g, (c) => {
      switch (c) {
        case '"': return '\\"';
        case '\\': return '\\\\';
        case '\n': return '\\n';
        case '\r': return '\\r';
        default: return c;
      }
    });
  }
}

// ============================================================
// Manifest
// ============================================================

export const LinearIntegration: IntegrationManifest = {
  id: 'linear',
  name: 'Linear',
  description:
    'List and create issues in Linear. Requires a personal API key (lin_api_...).',
  category: 'issues',
  authType: 'api_key',
  authFields: [
    {
      key: 'apiKey',
      label: 'Personal API Key',
      secret: true,
      placeholder: 'lin_api_XXXXXXXXXXXXXXXXXXXX',
    },
  ],
  getTools: (credentials: Record<string, string>) => {
    const getApiKey = () => credentials.apiKey;
    return [
      { definition: linearListIssuesDef, executor: new LinearListIssuesExecutor(getApiKey) },
      { definition: linearCreateIssueDef, executor: new LinearCreateIssueExecutor(getApiKey) },
    ];
  },
};
