/**
 * 应用内领域 UI 组件
 *
 * 基于 @svton/ui 二次封装的、与 devpilot 业务语义对齐的组件。
 * 与 @svton/ui 通用组件区分：本目录组件携带 devpilot 特定约定（如状态色映射、
 * token 驱动的聚焦环 ring-primary、min-h-11 触控目标等）。
 *
 * 统一出口，避免各页面深路径导入。
 */

// 状态 / 展示
export { StatusTag, type StatusTagProps, type StatusTone } from './status-tag';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { BlockedState, type BlockedStateProps } from './blocked-state';
export { PageHeader, type PageHeaderProps } from './page-header';
export { ErrorBanner, type ErrorBannerProps } from './error-banner';
export { DataBoundary, type DataBoundaryProps } from './data-boundary';
export { Alert, type AlertProps, type AlertTone } from './alert';
export { MetricCard } from './metric-card';
export { CodeBlock, type CodeBlockProps } from './code-block';

// 反馈 / 弹窗
export { Modal, type ModalProps } from './modal';
export { ConfirmDialog, type ConfirmDialogProps } from './confirm-dialog';
export {
  ActionMenu,
  type ActionMenuItem,
  type ActionMenuGroup,
} from './action-menu';

// 表格原语与筛选套件（@svton/ui 直通）
export {
  Table, TableHeader, TableBody, TableRow, TableHead, TableData,
  Thead, Tbody, Tr, Th, Td,
} from '@svton/ui';
export { TableFilterBar, TableFilterSearch, TableFilterSelect } from '@svton/ui';
export type {
  TableFilterBarProps,
  TableFilterSearchProps,
  TableFilterSelectProps,
} from '@svton/ui';

// 表单原语
export { Button, buttonVariants, type ButtonProps } from './button';
export { LinkButton, type LinkButtonProps } from './link-button';
export { Input, type InputProps } from './input';
export { Textarea, type TextareaProps } from './textarea';
export { Select, type SelectProps, type SelectOption } from './select';
export { Checkbox, type CheckboxProps } from './checkbox';
export { Radio, RadioGroup, type RadioProps, type RadioGroupProps } from './radio';
// Field（label/hint/error 布局原语）：@svton/ui 已有，本层统一出口供页面使用。
export { Field } from '@svton/ui';
