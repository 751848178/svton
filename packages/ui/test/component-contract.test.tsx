import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Dropdown, DropdownItem } from '../src/components/Dropdown';
import { Tooltip } from '../src/components/Tooltip';
import { Tabs } from '../src/components/Tabs';
import { Select } from '../src/components/Select';
import { Collapse, CollapseItem } from '../src/components/Collapse';
import { Badge } from '../src/components/Badge';
import { ProgressState } from '../src/components/ProgressState';
import { Spin } from '../src/components/Spin';
import { Tag } from '../src/components/Tag';
import { NotificationContainer, notification } from '../src/components/Notification';
import { useI18n, LocaleProvider } from '../src/i18n';

describe('Dropdown menu semantics and keyboard', () => {
  it('injects aria on trigger, navigates with arrows and closes on Escape', async () => {
    render(
      <Dropdown trigger={<button type="button">Menu</button>}>
        <DropdownItem>One</DropdownItem>
        <DropdownItem>Two</DropdownItem>
      </Dropdown>,
    );
    const trigger = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const itemOne = screen.getByRole('menuitem', { name: 'One' });
    // 打开后焦点异步落到第一项（等 0ms 定时器）
    await waitFor(() => expect(itemOne).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(itemOne).toHaveFocus();

    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Tooltip semantics', () => {
  it('wires aria-describedby and opens on focus, closes on Escape', () => {
    render(
      <Tooltip content="Explains" placement="top">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Hover me' });
    expect(button).not.toHaveAttribute('aria-describedby');

    fireEvent.focus(button);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Explains');
    expect(button).toHaveAttribute('aria-describedby', tooltip.id);

    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('Tabs multi-instance isolation', () => {
  it('keeps ids unique across two instances and navigates by arrow', () => {
    const onChange = vi.fn();
    const view = render(
      <div>
        <Tabs
          items={[{ key: 'a', label: 'A1', children: 'A1-content' }, { key: 'b', label: 'B1', children: 'B1-content' }]}
          onChange={onChange}
        />
        <Tabs
          items={[{ key: 'x', label: 'X', children: 'X-content' }, { key: 'y', label: 'Y', children: 'Y-content' }]}
          onChange={onChange}
        />
      </div>,
    );
    const tablists = screen.getAllByRole('tablist');
    expect(tablists).toHaveLength(2);
    const ids = [...view.container.querySelectorAll('[id^="tab-"]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    const firstTab = screen.getByRole('tab', { name: 'A1' });
    firstTab.focus();
    fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('b');
    const secondOfFirst = screen.getByRole('tab', { name: 'B1' });
    expect(secondOfFirst).toHaveFocus();
    expect(secondOfFirst).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Select enhanced branch', () => {
  const options = [
    { label: 'alpha', value: 'a' },
    { label: 'beta', value: 'b' },
    { label: 'gamma', value: 'c' },
  ];

  it('filters by search input and commits on Enter', () => {
    const onChange = vi.fn();
    render(<Select options={options} searchable placeholder="Choose" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'be' } });
    expect(screen.getByRole('option', { name: 'beta' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'alpha' })).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('b');
  });

  it('multiple toggles chips and clearable resets to empty array', () => {
    const ControlledView = () => {
      const [value, setValue] = React.useState<string[]>([]);
      return (
        <Select
          options={options}
          multiple
          clearable
          value={value}
          onChange={(e) => setValue(e.target.value as string[])}
        />
      );
    };
    render(<ControlledView />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'alpha' }));
    expect(screen.getByLabelText('Remove alpha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'beta' }));
    expect(screen.getByLabelText('Remove beta')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove beta'));
    expect(screen.queryByLabelText('Remove beta')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Remove alpha')).toBeInTheDocument();
  });

  it('empty text renders when no options match', () => {
    render(<Select options={options} searchable emptyText="Nothing here" />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe('Collapse accordion and controlled keys', () => {
  it('accordion keeps exactly one open', () => {
    render(
      <Collapse accordion>
        <CollapseItem itemKey="one" title="One">1</CollapseItem>
        <CollapseItem itemKey="two" title="Two">2</CollapseItem>
      </Collapse>,
    );
    const one = screen.getByRole('button', { name: 'One' });
    const two = screen.getByRole('button', { name: 'Two' });
    fireEvent.click(one);
    expect(one).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(two);
    expect(two).toHaveAttribute('aria-expanded', 'true');
    expect(one).toHaveAttribute('aria-expanded', 'false');
  });

  it('controlled activeKeys follows parent state', () => {
    const View = () => {
      const [keys, setKeys] = React.useState<string[]>([]);
      return (
        <Collapse activeKeys={keys} onChange={(next) => setKeys(next.map(String))}>
          <CollapseItem itemKey="one" title="One">1</CollapseItem>
        </Collapse>
      );
    };
    render(<View />);
    const one = screen.getByRole('button', { name: 'One' });
    fireEvent.click(one);
    expect(one).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Badge status and Tag checkable', () => {
  it('renders status dot with semantic color and label', () => {
    render(<Badge status="success">Healthy</Badge>);
    const label = screen.getByText('Healthy');
    expect(label).toBeInTheDocument();
    expect(label.parentElement?.querySelector('span')).toHaveStyle({
      backgroundColor: 'var(--svton-ui-status-success)',
    });
  });

  it('Tag checkable toggles pressed ring and stays keyboard-focused', () => {
    const onClick = vi.fn();
    render(
      <Tag onClick={onClick} checked>
        Filter
      </Tag>,
    );
    const tag = screen.getByRole('button', { name: 'Filter' });
    fireEvent.click(tag);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(tag.className).toContain('ring');
  });
});

describe('ProgressState / Spin / InfiniteScroll a11y', () => {
  it('exposes progressbar with aria-valuenow', () => {
    render(<ProgressState percent={42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('Spinner wraps children with aria-busy and defers via delay', () => {
    vi.useFakeTimers();
    try {
      const view = render(
        <Spin spinning delay={50}>
          <div>Content</div>
        </Spin>,
      );
      expect(view.container.firstElementChild).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(60));
      expect(screen.getByRole('status')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Notification registry', () => {
  function WithI18n({ children }: { children: React.ReactNode }) {
    return <LocaleProvider locale="en">{children}</LocaleProvider>;
  }

  it('keeps two placements independent and closeAll clears everything', async () => {
    render(
      <WithI18n>
        <NotificationContainer placement="topRight" />
        <NotificationContainer placement="bottomLeft" />
      </WithI18n>,
    );
    act(() => {
      notification.success({ title: 'A1' });
      notification.info({ title: 'B1' });
    });
    expect(await screen.findByText('A1')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();

    act(() => notification.closeAll());
    await waitFor(() => {
      expect(screen.queryByText('A1')).not.toBeInTheDocument();
      expect(screen.queryByText('B1')).not.toBeInTheDocument();
    });
  });

  it('upserts by key instead of stacking duplicates', async () => {
    render(
      <WithI18n>
        <NotificationContainer />
      </WithI18n>,
    );
    act(() => {
      notification.info({ key: 'job-x', title: 'Running' });
      notification.info({ key: 'job-x', title: 'Running…' });
    });
    expect(screen.getByText('Running…')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });
});
