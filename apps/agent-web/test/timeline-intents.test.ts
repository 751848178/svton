import { describe, expect, it, vi } from 'vitest';
import { createWebTimelineIntentHandler } from '../src/components/use-web-timeline-intents';

describe('web timeline intents', () => {
  it('copies typed file targets but reports file open unavailable', async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const handler = createWebTimelineIntentHandler(vi.fn());
    await expect(handler({
      type: 'copy', target: 'path', value: '/workspace/app.ts',
    })).resolves.toEqual({ status: 'handled' });
    await expect(handler({
      type: 'open', target: 'path', value: '/workspace/app.ts',
    })).resolves.toEqual({ status: 'unavailable', message: 'open unavailable in this host' });
    expect(writeText).toHaveBeenCalledWith('/workspace/app.ts');
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
