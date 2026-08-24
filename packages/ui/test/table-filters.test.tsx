import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TableFilterBar, TableFilterSearch, TableFilterSelect } from '../src/components/TableFilters';

describe('TableFilters suite', () => {
  it('FilterBar lays out filters left and actions slot right', () => {
    const html = renderToStaticMarkup(
      <TableFilterBar actions={<span data-testid="count">3 条</span>}>
        <span>filter-a</span>
      </TableFilterBar>,
    );
    expect(html).toContain('border-b bg-card p-4');
    expect(html).toContain('filter-a');
    expect(html).toContain('3 条');
    // actions 槽在筛选区之后（DOM 顺序）
    expect(html.indexOf('filter-a')).toBeLessThan(html.indexOf('3 条'));
  });

  it('FilterSearch renders a search input with leading icon and compact size', () => {
    const html = renderToStaticMarkup(
      <TableFilterSearch
        value="pic"
        aria-label="搜索项目"
      />,
    );
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="搜索项目"');
    expect(html).toContain('min-h-9');
    expect(html).toContain('pl-8');
  });

  it('FilterSelect renders inline label + custom combobox (options render on open, not in SSR)', () => {
    const html = renderToStaticMarkup(
      <TableFilterSelect
        label="状态"
        aria-label="按状态筛选"
        options={[
          { label: '全部', value: 'all' },
          { label: '运行中', value: 'online' },
        ]}
      />,
    );
    expect(html).toContain('状态');
    // 自定义分支：SSR 只渲染触发器与隐藏镜像 select，选项面板在打开后 Portal 渲染
    expect(html).toContain('role="combobox"');
    expect(html).not.toContain('value="all"');
    expect(html).toContain('aria-label="按状态筛选"');
    expect(html).toContain('min-h-9');
    expect(html).toContain('w-auto');
  });

  it('FilterSelect without label renders the bare control', () => {
    const html = renderToStaticMarkup(
      <TableFilterSelect
        aria-label="排序"
        options={[{ label: '最新', value: 'latest' }]}
      />,
    );
    expect(html).not.toContain('<label');
    expect(html).toContain('role="combobox"');
  });
});
