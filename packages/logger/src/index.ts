// Core
export { Logger, createLogger } from './logger';

// Types
export type {
  LogLevel,
  StackLevel,
  LogEvent,
  LoggerConfig,
  LoggerPlugin,
  PluginHooks,
  UserInfo,
  PageInfo,
  DeviceInfo,
  PerformanceMetrics,
  Breadcrumb,
  BreadcrumbType,
  ReportStrategy,
} from './types';

// Capture utilities
export { setupPerformanceMonitor, getPerformanceMetrics } from './capture/performance';
export type { PerformanceMonitorOptions } from './capture/performance';

export { setupErrorCapture, wrapWithErrorCapture } from './capture/error';
export type { ErrorCaptureOptions } from './capture/error';

// Utils
export { shouldLog, shouldIncludeStack, getStackTrace, getDeviceInfo, getPageInfo } from './utils';
