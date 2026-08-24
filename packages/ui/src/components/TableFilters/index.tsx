import React from 'react';
import { cn } from '../../lib/utils';
import { Input } from '../Input';
import { Select, type SelectOption } from '../Select';
import { SearchIcon } from '../../icons';

/**
 * 表格筛选组件套件
 *
 * 与 Table 原语配套的组合式筛选件（不做配置驱动的单体，保持 children 组合习惯）：
 *  - TableFilterBar    工具栏容器（筛选区左对齐，actions 槽右对齐，窄屏自动换行）
 *  - TableFilterSearch 搜索框（放大镜图标 + 受控清空按钮，Enter/输入即筛）
 *  - TableFilterSelect 带内联标签的下拉筛选（标签为视觉提示，控件本身带 aria-label）
 *
 * 单一职责：筛选输入的布局与可访问性归一，不含数据获取与过滤逻辑。
 */

export interface TableFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 右侧动作槽（计数、列配置等次要内容）。 */
  actions?: React.ReactNode;
}

export function TableFilterBar(props: TableFilterBarProps) {
  const { actions, className, children, ...rest } = props;
  return (
    <div
      className={cn('flex flex-col gap-3 border-b bg-card p-4 lg:flex-row lg:items-center', className)}
      {...rest}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  );
}

export interface TableFilterSearchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** 无障碍名称（不传时须由外层 label 提供）。 */
  'aria-label'?: string;
  /** 输入框宽度类（默认 w-64，可被 className 覆盖）。 */
  widthClassName?: string;
  /** 尺寸透传给 Input（默认 sm 行内）。 */
  size?: 'sm' | 'md';
}

export function TableFilterSearch(props: TableFilterSearchProps) {
  const { className, widthClassName = 'w-64', size = 'sm', ...rest } = props;
  return (
    <span className={cn('relative inline-block', widthClassName, className)}>
      <SearchIcon
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        size={size}
        className="pl-8 pr-8"
        {...rest}
      />
    </span>
  );
}

export interface TableFilterSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** 内联标签（渲染在控件左侧的视觉提示）。 */
  label?: React.ReactNode;
  /** 选项数组（也可用 children）。 */
  options?: SelectOption[];
  /** 占位项。 */
  placeholder?: string;
  /** 无效态。 */
  invalid?: boolean;
  /** 尺寸（默认 sm 行内）。 */
  size?: 'sm' | 'md';
}

export function TableFilterSelect(props: TableFilterSelectProps) {
  const { label, options, placeholder, invalid, size = 'sm', className, ...rest } = props;
  const control = (
    <Select
      options={options}
      placeholder={placeholder}
      invalid={invalid}
      size={size}
      className={cn('w-auto', className)}
      {...rest}
    />
  );
  if (label === undefined) return control;
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="whitespace-nowrap">{label}</span>
      {control}
    </label>
  );
}
