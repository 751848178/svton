/**
 * 应用内领域 UI 组件
 *
 * 基于 @svton/ui 二次封装的、与 devpilot 业务语义对齐的组件。
 * 与 @svton/ui 通用组件区分：本目录组件携带 devpilot 特定约定（如状态色映射）。
 */

export { StatusTag, type StatusTagProps, type StatusTone } from './status-tag';
export { PageHeader, type PageHeaderProps } from './page-header';
export { ErrorBanner, type ErrorBannerProps } from './error-banner';
export { MetricCard } from './metric-card';
export { Modal, type ModalProps } from './modal';
