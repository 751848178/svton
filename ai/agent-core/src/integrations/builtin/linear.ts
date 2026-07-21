/**
 * Linear integration manifest.
 */

import type { IntegrationManifest } from '../types';
import { linearCreateIssueDef, LinearCreateIssueExecutor } from './linear-create-issue.service';
import { linearListIssuesDef, LinearListIssuesExecutor } from './linear-list-issues.service';

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
      placeholder: 'lin_api_...',
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
