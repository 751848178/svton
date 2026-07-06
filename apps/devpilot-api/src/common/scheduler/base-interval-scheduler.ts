import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

/**
 * 周期性 interval 调度器的共享基类。
 *
 * 取代历史上 11 个 `XxxSchedulerService` 各自复制的
 * `OnModuleInit → setInterval → clearInterval` + `running` 布尔重入守卫模板。
 *
 * 周期执行交给 `@nestjs/schedule` 的 `SchedulerRegistry`（动态注册/注销 interval），
 * 重入保护仍由本基类持有 `running` 标志（@nestjs/schedule 本身不互斥）。
 *
 * `SchedulerRegistry` 用 `@Optional()` 注入：单测直接 `new XxxScheduler(...)` 不传它时
 * 基类会跳过 interval 注册，业务逻辑（`runOnce`）仍可独立测试。
 *
 * 子类只需实现：
 *  - {@link schedulerName}：日志与 interval 注册名
 *  - {@link isEnabled}：是否启用（读各自 env 开关）
 *  - {@link intervalMs}：周期毫秒（读各自 env）
 *  - {@link runOnce}：单次业务逻辑（无需关心 enabled/重入，基类已处理）
 *
 * `runOnce` 在被并发触发（上一轮未结束）时会跳过并返回 `undefined`。
 */
@Injectable()
export abstract class BaseIntervalScheduler implements OnModuleInit, OnModuleDestroy {
  protected abstract readonly logger: Logger;
  private running = false;
  private intervalKey?: string;

  constructor(@Optional() protected readonly schedulerRegistry?: SchedulerRegistry) {}

  abstract schedulerName(): string;
  abstract isEnabled(): boolean;
  abstract intervalMs(): number;

  /** 单次调度任务。基类保证同一时刻只有一个实例在跑。返回 undefined 表示被跳过。 */
  abstract runOnce(now?: Date): Promise<unknown>;

  onModuleInit() {
    if (!this.isEnabled() || !this.schedulerRegistry) {
      return;
    }
    const interval = this.intervalMs();
    const callback = () => {
      void this.runOnceSafe();
    };
    this.intervalKey = this.schedulerName();
    this.schedulerRegistry.addInterval(this.intervalKey, setInterval(callback, interval));
    this.logger.log(`${this.schedulerName()} enabled; interval=${interval}ms`);
  }

  onModuleDestroy() {
    if (
      this.intervalKey &&
      this.schedulerRegistry?.doesExist('interval', this.intervalKey)
    ) {
      this.schedulerRegistry.deleteInterval(this.intervalKey);
    }
  }

  /**
   * 重入安全地执行 {@link runOnce}：若上一轮仍在跑则跳过。
   * interval 回调走这里。外部测试通常直接调 `runOnce`（其内部也会用
   * {@link tryAcquireRunLock} 做守卫，因此并发调用同样会看到跳过语义）。
   */
  protected async runOnceSafe(now?: Date): Promise<unknown> {
    return this.runOnce(now);
  }

  /** 当前是否正在执行（供测试/监控断言）。 */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 尝试获取重入锁。子类在 `runOnce` 开头调用：
   * 若返回 false 表示已有任务在跑，子类应返回"跳过"摘要。
   * 必须在 finally 中调用 {@link releaseRunLock} 释放。
   */
  protected tryAcquireRunLock(): boolean {
    if (this.running) {
      return false;
    }
    this.running = true;
    return true;
  }

  protected releaseRunLock(): void {
    this.running = false;
  }
}

