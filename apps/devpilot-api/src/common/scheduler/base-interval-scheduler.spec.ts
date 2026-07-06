import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BaseIntervalScheduler } from './base-interval-scheduler';

describe('BaseIntervalScheduler', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('registers and removes enabled intervals through SchedulerRegistry', () => {
    jest.useFakeTimers();
    const registry = createRegistryMock();
    const scheduler = new TestIntervalScheduler(registry as unknown as SchedulerRegistry);

    scheduler.onModuleInit();

    expect(registry.addInterval).toHaveBeenCalledWith('test-interval', expect.any(Object));
    expect(registry.intervals.has('test-interval')).toBe(true);

    scheduler.onModuleDestroy();

    expect(registry.deleteInterval).toHaveBeenCalledWith('test-interval');
    expect(registry.intervals.has('test-interval')).toBe(false);
  });

  it('skips interval registration when disabled or registry is absent', () => {
    const disabledRegistry = createRegistryMock();
    new TestIntervalScheduler(disabledRegistry as unknown as SchedulerRegistry, false).onModuleInit();
    new TestIntervalScheduler(undefined, true).onModuleInit();

    expect(disabledRegistry.addInterval).not.toHaveBeenCalled();
  });
});

class TestIntervalScheduler extends BaseIntervalScheduler {
  protected readonly logger = new Logger(TestIntervalScheduler.name);

  constructor(
    schedulerRegistry?: SchedulerRegistry,
    private readonly enabled = true,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'test-interval';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  intervalMs(): number {
    return 1000;
  }

  async runOnce(): Promise<void> {}
}

function createRegistryMock() {
  const intervals = new Map<string, ReturnType<typeof setInterval>>();
  return {
    intervals,
    addInterval: jest.fn((name: string, interval: ReturnType<typeof setInterval>) => {
      intervals.set(name, interval);
    }),
    doesExist: jest.fn((type: string, name: string) => type === 'interval' && intervals.has(name)),
    deleteInterval: jest.fn((name: string) => {
      const interval = intervals.get(name);
      if (interval) {
        clearInterval(interval);
      }
      intervals.delete(name);
    }),
  };
}
