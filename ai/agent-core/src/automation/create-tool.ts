/**
 * create_automation tool — lets the LLM create scheduled tasks from natural language.
 */
import type { ToolDefinition } from '../provider/types';
import type { ToolCall, ToolResult, IToolExecutor, ToolContext } from '../tool/types';
import { AutomationManager } from './manager';

export const createAutomationDef: ToolDefinition = {
  name: 'create_automation',
  description: [
    'Create a scheduled automation task that runs on a recurring basis.',
    'The schedule can be natural language or a cron expression.',
    '',
    'Schedule examples:',
    '- "every 30 minutes" → interval trigger',
    '- "every day at 9am" → cron trigger (0 9 * * *)',
    '- "weekly on monday at 10:00" → cron trigger (0 10 * * 1)',
    '- "0 */6 * * *" → cron every 6 hours',
    '- "on git_commit" → event trigger',
  ].join('\n'),
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Short name for this automation (e.g. "Daily PR Check")',
      },
      schedule: {
        type: 'string',
        description: 'When to run. Natural language or cron expression. Examples: "every day at 9am", "every 30 minutes", "0 */6 * * *", "on file_save"',
      },
      prompt: {
        type: 'string',
        description: 'The prompt/task to execute when this automation triggers. This is what the agent will do each time.',
      },
      description: {
        type: 'string',
        description: 'Optional longer description of what this automation does.',
      },
    },
    required: ['name', 'schedule', 'prompt'],
  },
  annotations: {
    destructiveHint: false,
    readOnlyHint: false,
    openWorldHint: false,
  },
};

export class CreateAutomationExecutor implements IToolExecutor {
  constructor(private manager: AutomationManager) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { name, schedule, prompt, description } = call.arguments as {
      name?: string;
      schedule?: string;
      prompt?: string;
      description?: string;
    };

    if (!name || !schedule || !prompt) {
      return {
        callId: call.id,
        output: 'Error: name, schedule, and prompt are required.',
        isError: true,
      };
    }

    try {
      const trigger = AutomationManager.parseSchedule(schedule);
      const def = await this.manager.create({
        name,
        description: description || '',
        trigger,
        prompt,
      });

      const triggerDesc = trigger.type === 'interval'
        ? `every ${trigger.minutes} minutes`
        : trigger.type === 'cron'
          ? `cron: ${trigger.expression}`
          : `on event: ${trigger.eventType}`;

      return {
        callId: call.id,
        output: `✅ Automation "${name}" created successfully.\nTrigger: ${triggerDesc}\nNext run: ${def.nextRunAt ? new Date(def.nextRunAt).toLocaleString() : 'on event'}\n\nThe automation will execute automatically when triggered. Results are saved in the automation history.`,
      };
    } catch (e) {
      return {
        callId: call.id,
        output: `Failed to create automation: ${e instanceof Error ? e.message : String(e)}`,
        isError: true,
      };
    }
  }
}
