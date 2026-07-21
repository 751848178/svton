/**
 * Slack integration manifest.
 */

import type { IntegrationManifest } from '../types';
import { slackPostMessageDef, SlackPostMessageExecutor } from './slack-post-message.service';
import { slackSearchDef, SlackSearchExecutor } from './slack-search.service';

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
