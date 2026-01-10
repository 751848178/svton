import type { Logger } from '../logger';
import type { PerformanceMetrics } from '../types';

/**
 * 性能监控配置
 */
export interface PerformanceMonitorOptions {
  /** 是否监控 Web Vitals */
  webVitals?: boolean;
  /** 是否监控资源加载 */
  resources?: boolean;
  /** 是否监控长任务 */
  longTasks?: boolean;
  /** 长任务阈值 (ms) */
  longTaskThreshold?: number;
}

/**
 * 设置性能监控
 */
export function setupPerformanceMonitor(
  logger: Logger,
  options: PerformanceMonitorOptions = {}
): () => void {
  const {
    webVitals = true,
    resources = false,
    longTasks = false,
    longTaskThreshold = 50,
  } = options;

  const cleanups: (() => void)[] = [];

  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const metrics: PerformanceMetrics = {};

  // 监控 Web Vitals
  if (webVitals) {
    // FCP
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcp) {
          metrics.fcp = fcp.startTime;
          logger.info('Performance: FCP', { fcp: metrics.fcp });
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
      cleanups.push(() => fcpObserver.disconnect());
    } catch {
      // Observer not supported
    }

    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          metrics.lcp = lastEntry.startTime;
          logger.info('Performance: LCP', { lcp: metrics.lcp });
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      cleanups.push(() => lcpObserver.disconnect());
    } catch {
      // Observer not supported
    }

    // FID
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[];
        const firstInput = entries[0];
        if (firstInput) {
          metrics.fid = firstInput.processingStart - firstInput.startTime;
          logger.info('Performance: FID', { fid: metrics.fid });
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      cleanups.push(() => fidObserver.disconnect());
    } catch {
      // Observer not supported
    }

    // CLS
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[];
        for (const entry of entries) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value || 0;
          }
        }
        metrics.cls = clsValue;
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      cleanups.push(() => {
        clsObserver.disconnect();
        if (metrics.cls !== undefined) {
          logger.info('Performance: CLS', { cls: metrics.cls });
        }
      });
    } catch {
      // Observer not supported
    }

    // Navigation Timing
    if (typeof window !== 'undefined') {
      const reportNavigationTiming = () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          metrics.ttfb = navigation.responseStart - navigation.requestStart;
          metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.startTime;
          metrics.load = navigation.loadEventEnd - navigation.startTime;

          logger.info('Performance: Navigation', {
            ttfb: metrics.ttfb,
            domContentLoaded: metrics.domContentLoaded,
            load: metrics.load,
          });
        }
      };

      if (document.readyState === 'complete') {
        reportNavigationTiming();
      } else {
        window.addEventListener('load', reportNavigationTiming);
        cleanups.push(() => window.removeEventListener('load', reportNavigationTiming));
      }
    }
  }

  // 监控资源加载
  if (resources) {
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        for (const entry of entries) {
          if (entry.duration > 1000) {
            // 只记录超过 1s 的资源
            logger.warn('Performance: Slow Resource', {
              name: entry.name,
              duration: entry.duration,
              transferSize: entry.transferSize,
              initiatorType: entry.initiatorType,
            });
          }
        }
      });
      resourceObserver.observe({ type: 'resource', buffered: true });
      cleanups.push(() => resourceObserver.disconnect());
    } catch {
      // Observer not supported
    }
  }

  // 监控长任务
  if (longTasks) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.duration > longTaskThreshold) {
            logger.warn('Performance: Long Task', {
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
      cleanups.push(() => longTaskObserver.disconnect());
    } catch {
      // Observer not supported
    }
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}

/**
 * 获取当前性能指标
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  if (typeof window === 'undefined') {
    return {};
  }

  const metrics: PerformanceMetrics = {};

  // Navigation Timing
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (navigation) {
    metrics.ttfb = navigation.responseStart - navigation.requestStart;
    metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.startTime;
    metrics.load = navigation.loadEventEnd - navigation.startTime;
  }

  // Paint Timing
  const paintEntries = performance.getEntriesByType('paint');
  const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
  if (fcp) {
    metrics.fcp = fcp.startTime;
  }

  return metrics;
}
