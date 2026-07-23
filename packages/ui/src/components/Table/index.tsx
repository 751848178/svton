import React, { ReactNode, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/**
 * Table 表格原语
 *
 * 复合组件：Table > TableHeader/TableBody > TableRow > TableHead/TableData。
 * 单一职责：结构 + 表格基线样式，不内置数据获取/分页（业务侧用 children 组合）。
 */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** 是否带边框（默认 true） */
  bordered?: boolean;
}

export function Table(props: TableProps) {
  const { bordered = true, className, children, ...rest } = props;
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full text-sm', bordered && 'border-collapse', className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  const { className, ...rest } = props;
  return <thead className={cn('border-b border-black/10', className)} {...rest} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  const { className, ...rest } = props;
  return <tbody className={cn('divide-y divide-black/5', className)} {...rest} />;
}

export function TableRow(props: HTMLAttributes<HTMLTableRowElement>) {
  const { className, ...rest } = props;
  return (
    <tr
      className={cn('transition-colors hover:bg-accent/50', className)}
      {...rest}
    />
  );
}

export function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>) {
  const { className, ...rest } = props;
  return (
    <th
      className={cn(
        'px-3 py-2 text-left text-xs font-semibold text-muted-foreground',
        className,
      )}
      {...rest}
    />
  );
}

export function TableData(props: TdHTMLAttributes<HTMLTableCellElement>) {
  const { className, ...rest } = props;
  return <td className={cn('px-3 py-2 align-middle', className)} {...rest} />;
}

// 语义别名（与社区命名对齐，便于迁移）
export { TableHeader as Thead, TableBody as Tbody, TableRow as Tr, TableHead as Th, TableData as Td };
