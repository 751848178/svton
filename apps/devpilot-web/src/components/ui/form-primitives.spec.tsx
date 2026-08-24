// @vitest-environment jsdom

/** 表单原语契约：尺寸变体、无效态 aria 透传、Checkbox/Radio 标签结构。 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Checkbox, Input, Radio, RadioGroup, Select, Textarea } from '@/components/ui';

describe('form primitives', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('Input applies md/sm size classes and passes aria-invalid', async () => {
    await act(async () => {
      root.render(
        <div>
          <Input data-testid="md" />
          <Input data-testid="sm" size="sm" />
          <Input data-testid="bad" invalid />
        </div>,
      );
    });
    expect(container.querySelector('[data-testid="md"]')!.className).toContain('min-h-11');
    expect(container.querySelector('[data-testid="md"]')!.className).toContain('text-sm');
    expect(container.querySelector('[data-testid="sm"]')!.className).toContain('min-h-9');
    expect(container.querySelector('[data-testid="sm"]')!.className).toContain('text-xs');
    expect(container.querySelector('[data-testid="bad"]')!.getAttribute('aria-invalid')).toBe(
      'true',
    );
  });

  it('Select renders custom combobox by default: placeholder on trigger, size/aria wiring, mirror for forms', async () => {
    await act(async () => {
      root.render(
        <Select
          placeholder="请选择"
          options={[{ label: 'A', value: 'a' }]}
        />,
      );
    });
    // 自定义分支：占位符显示在触发器上，选项面板打开后才渲染
    const combobox = container.querySelector('[role="combobox"]')!;
    expect(combobox.textContent).toContain('请选择');
    expect(container.querySelector('select.sr-only')).not.toBeNull();

    await act(async () => {
      root.render(
        <Select
          invalid
          size="sm"
          options={[{ label: 'A', value: 'a' }]}
        />,
      );
    });
    const trigger = container.querySelector('[role="combobox"]')!;
    expect(trigger.className).toContain('min-h-9');
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
  });

  it('Select native escape hatch keeps legacy <select> rendering', async () => {
    await act(async () => {
      root.render(
        <Select
          native
          placeholder="请选择"
          options={[{ label: 'A', value: 'a' }]}
        />,
      );
    });
    const placeholder = container.querySelector('option[value=""]')!;
    expect(placeholder.hasAttribute('hidden')).toBe(true);
  });

  it('Textarea sm variant and aria-invalid', async () => {
    await act(async () => {
      root.render(
        <div>
          <Textarea data-testid="a" />
          <Textarea data-testid="b" size="sm" invalid />
        </div>,
      );
    });
    expect(container.querySelector('[data-testid="a"]')!.className).toContain('min-h-[80px]');
    const sm = container.querySelector('[data-testid="b"]')!;
    expect(sm.className).toContain('min-h-16');
    expect(sm.getAttribute('aria-invalid')).toBe('true');
  });

  it('Checkbox wraps label/description and toggles by clicking the label text', async () => {
    const onChange = vi.fn();
    await act(async () => {
      root.render(
        <Checkbox
          label="共享给预发"
          description="仅在勾选后写入"
          onChange={onChange}
        />,
      );
    });
    const label = container.querySelector('label')!;
    expect(label.textContent).toContain('共享给预发');
    expect(label.textContent).toContain('仅在勾选后写入');
    const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.className).toContain('accent-primary');
    await act(async () => {
      box.click();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('Radio renders a radiogroup with labelled options', async () => {
    await act(async () => {
      root.render(
        <RadioGroup aria-label="绑定方式">
          <Radio name="mode" value="existing" label="绑定既有" />
          <Radio
            name="mode"
            value="shared"
            label="使用共享"
            description="跨环境共享实例"
          />
        </RadioGroup>,
      );
    });
    const group = container.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('绑定方式');
    const radios = [...container.querySelectorAll('input[type="radio"]')];
    expect(radios).toHaveLength(2);
    expect(radios[0].className).toContain('accent-primary');
    expect(container.textContent).toContain('跨环境共享实例');
  });
});
