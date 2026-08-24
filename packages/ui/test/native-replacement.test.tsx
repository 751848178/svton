import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Select } from '../src/components/Select';
import { ScrollArea } from '../src/components/ScrollArea';

describe('Select R-01: full custom rendering by default', () => {
  const options = [
    { label: 'alpha', value: 'a' },
    { label: 'beta', value: 'b' },
  ];

  it('renders children <option> as custom listbox options (legacy usage migration)', () => {
    const onChange = vi.fn();
    render(
      <Select value="" onChange={onChange}>
        <option value="">请选择</option>
        <option value="a">alpha</option>
        <option value="b" disabled>
          beta
        </option>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'alpha' })).toBeInTheDocument();
    // disabled 选项不可激活
    fireEvent.click(screen.getByRole('option', { name: 'beta' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: 'alpha' }));
    expect(onChange.mock.calls[0][0].target.value).toBe('a');
  });

  it('flattens <optgroup> children', () => {
    render(
      <Select onChange={() => undefined}>
        <optgroup label="Group">
          <option value="x">X</option>
        </optgroup>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'X' })).toBeInTheDocument();
  });

  it('native escape hatch keeps legacy select markup and hidden placeholder option', () => {
    render(
      <Select native placeholder="请选择" options={options} />,
    );
    // 自定义分支的标记不存在
    expect(document.querySelector('[data-svton-select-combobox]')).toBeNull();
    const nativeSelect = document.querySelector('select:not(.sr-only)') as HTMLSelectElement;
    expect(nativeSelect).not.toBeNull();
    const hidden = nativeSelect.querySelector('option[value=""]')!;
    expect(hidden.hasAttribute('hidden')).toBe(true);
  });

  it('mirror select carries name/ref for form (RHF register) compatibility', async () => {
    const mirrorRef = { current: null as HTMLSelectElement | null };
    let captured = '';
    const View = () => (
      <Select
        name="provider"
        ref={mirrorRef}
        value={undefined}
        onChange={(e) => {
          captured = e.target.value;
        }}
      >
        <option value="">none</option>
        <option value="github">GitHub</option>
      </Select>
    );
    render(<View />);
    const mirror = document.querySelector('select.sr-only') as HTMLSelectElement;
    expect(mirror).not.toBeNull();
    expect(mirror.name).toBe('provider');
    expect(mirrorRef.current).toBe(mirror);

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'GitHub' }));
    expect(captured).toBe('github');
    await waitFor(() => expect(mirror.value).toBe('github'));
  });

  it('closing the panel synthesizes blur with current value (RHF touched)', () => {
    const onBlur = vi.fn();
    render(
      <Select
        name="auth"
        onBlur={onBlur}
        value="a"
        onChange={() => undefined}
        options={options}
      />,
    );
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(onBlur.mock.calls[0][0].target.value).toBe('a');
  });

  it('IME composition guards Enter from committing', () => {
    const onChange = vi.fn();
    render(<Select searchable options={options} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'al' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('controlled multiple keeps chips in sync', () => {
    const Controlled = () => {
      const [value, setValue] = useState<string[]>([]);
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
    render(<Controlled />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'alpha' }));
    expect(screen.getByLabelText('Remove alpha')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Clear all'));
    expect(screen.queryByLabelText('Remove alpha')).not.toBeInTheDocument();
  });

  it('className reaches root so w-auto overrides default w-full', () => {
    render(<Select className="w-auto" options={options} />);
    const root = document.querySelector('[data-svton-select-combobox]')!;
    expect(root.className).toContain('w-auto');
    expect(root.className).not.toContain('w-full');
  });

  it('options render as single-line ellipsis with full-text title (antd semantics)', () => {
    render(<Select value="a" options={[{ label: 'a long label '.repeat(20), value: 'a' }]} />);
    fireEvent.click(screen.getByRole('combobox'));
    const optionLabel = screen.getByRole('option').querySelector('span');
    expect(optionLabel?.className).toContain('truncate');
    expect(optionLabel?.getAttribute('title')).toBe('a long label '.repeat(20));
  });

  it('popupMatchSelectWidth=false sizes panel to content (min-width = trigger)', () => {
    render(
      <Select popupMatchSelectWidth={false} options={[...options, { label: 'very very very long', value: 'c' }]} />,
    );
    fireEvent.click(screen.getByRole('combobox'));
    const panel = screen.getByRole('listbox');
    // 不锁死宽度：面板宽度走内容（max-content），仅保留触发器宽作为下限
    expect(panel.style.width).toBe('max-content');
    expect(panel.style.minWidth).not.toBe('');
    expect(panel.style.maxWidth).not.toBe('');
  });

  it('popupMatchSelectWidth=true matches trigger width exactly', () => {
    render(<Select searchable options={options} />);
    fireEvent.click(screen.getByRole('combobox'));
    const panel = screen.getByRole('listbox');
    expect(panel.style.width).toBe('100%'); // jsdom 无尺寸，fallback '100%'
    expect(panel.style.minWidth).toBe('');
  });
});

describe('ScrollArea R-04: custom scrollbar', () => {
  function mockScrollMetrics(el: HTMLElement, opts: { client: number; scroll: number }) {
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: opts.client });
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: opts.scroll });
    Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: 0 });
  }

  it('draws a vertical thumb sized by viewport/content ratio', () => {
    const view = render(
      <ScrollArea maxHeight={100} type="always">
        <div style={{ height: 400 }}>tall</div>
      </ScrollArea>,
    );
    const viewport = view.container.querySelector('.overflow-auto')!;
    mockScrollMetrics(viewport as HTMLElement, { client: 100, scroll: 400 });
    fireEvent.scroll(viewport);
    const thumb = view.container.querySelector('[data-testid="scrollbar-y"] > div') as HTMLElement;
    expect(thumb).not.toBeNull();
    // thumb 高度 = 100/400 = 25%（下限 10%，此处为 25%）
    expect(thumb.style.height).toBe('25%');
    expect(Number.parseFloat(thumb.style.top)).toBe(0);
  });

  it('keeps thumb offset in sync after scrolling', () => {
    const view = render(
      <ScrollArea maxHeight={100} type="always">
        <div style={{ height: 400 }}>tall</div>
      </ScrollArea>,
    );
    const viewport = view.container.querySelector('.overflow-auto') as HTMLElement;
    mockScrollMetrics(viewport, { client: 100, scroll: 400 });
    viewport.scrollTop = 150; // 一半
    fireEvent.scroll(viewport);
    const thumb = view.container.querySelector('[data-testid="scrollbar-y"] > div') as HTMLElement;
    expect(thumb.style.top).toBe('37.5%'); // 50% 滚动 × (100-25)% 可移动区
  });
});
