import React from 'react';
import type { ReactNode } from 'react';
import type { SelectOption } from './types';

/**
 * 从 JSX children 中解析原生 <option>/<optgroup> 为 SelectOption[]。
 *
 * 存量消费方以 children 形态书写选项（含 i18n 文案、map 展开、空值占位项），
 * 全量自定义渲染必须吃下这一形态才能做到零改动迁移。
 * label 仅支持可文本化内容（string/number/一维字符串节点）；复杂 JSX 请用 renderOption。
 */

function toText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (React.isValidElement(node)) return toText((node.props as { children?: ReactNode }).children);
  if (Array.isArray(node)) return node.map(toText).join('');
  return '';
}

interface OptionLikeProps {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
}

export function optionsFromChildren(children: ReactNode): SelectOption[] {
  const collected: SelectOption[] = [];

  const walk = (nodes: ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement<OptionLikeProps>(child)) return;
      const elementType = typeof child.type === 'string' ? child.type : '';
      if (elementType === 'optgroup') {
        walk(child.props.children);
        return;
      }
      if (elementType !== 'option') return;
      const raw = child.props.value;
      if (raw === undefined) return;
      collected.push({
        label: toText(child.props.children),
        value: String(raw),
        disabled: child.props.disabled,
      });
    });
  };

  walk(children);
  return collected;
}
