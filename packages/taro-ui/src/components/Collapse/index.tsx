/**
 * Collapse 折叠面板组件
 *
 * 功能特性：
 * - 手风琴模式
 * - 自定义标题和内容
 * - 禁用状态
 */
import { useState, ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export interface CollapseItemData {
  /** 唯一标识 */
  key: string;
  /** 标题 */
  title: ReactNode;
  /** 右侧内容 */
  value?: ReactNode;
  /** 面板内容 */
  content?: ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface CollapseProps {
  /** 展开的面板 key */
  activeKey?: string | string[];
  /** 默认展开的面板 key */
  defaultActiveKey?: string | string[];
  /** 是否手风琴模式 */
  accordion?: boolean;
  /** 是否显示边框 */
  border?: boolean;
  /** 面板数据 */
  items?: CollapseItemData[];
  /** 展开变化回调 */
  onChange?: (activeKey: string | string[]) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export interface CollapseItemProps {
  /** 唯一标识 */
  itemKey: string;
  /** 标题 */
  title: ReactNode;
  /** 右侧内容 */
  value?: ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否展开 */
  expanded?: boolean;
  /** 切换回调 */
  onToggle?: (key: string) => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Collapse(props: CollapseProps) {
  const {
    activeKey,
    defaultActiveKey = [],
    accordion = false,
    border = true,
    items = [],
    onChange,
    children,
    className = '',
    style,
  } = props;

  // 内部状态
  const [innerActiveKey, setInnerActiveKey] = useState<string[]>(() => {
    const defaultKeys = Array.isArray(defaultActiveKey)
      ? defaultActiveKey
      : defaultActiveKey ? [defaultActiveKey] : [];
    return defaultKeys;
  });

  // 受控/非受控
  const currentActiveKey = activeKey !== undefined
    ? (Array.isArray(activeKey) ? activeKey : [activeKey])
    : innerActiveKey;

  const handleToggle = usePersistFn((key: string) => {
    let newActiveKey: string[];

    if (accordion) {
      // 手风琴模式
      newActiveKey = currentActiveKey.includes(key) ? [] : [key];
    } else {
      // 普通模式
      if (currentActiveKey.includes(key)) {
        newActiveKey = currentActiveKey.filter(k => k !== key);
      } else {
        newActiveKey = [...currentActiveKey, key];
      }
    }

    if (activeKey === undefined) {
      setInnerActiveKey(newActiveKey);
    }

    onChange?.(accordion ? (newActiveKey[0] || '') : newActiveKey);
  });

  const collapseClass = [
    'svton-collapse',
    border ? 'svton-collapse--border' : '',
    className,
  ].filter(Boolean).join(' ');

  // 使用 children 或 items
  if (children) {
    return (
      <View className={collapseClass} style={style}>
        {children}
      </View>
    );
  }

  return (
    <View className={collapseClass} style={style}>
      {items.map((item) => (
        <CollapseItem
          key={item.key}
          itemKey={item.key}
          title={item.title}
          value={item.value}
          disabled={item.disabled}
          expanded={currentActiveKey.includes(item.key)}
          onToggle={handleToggle}
        >
          {item.content}
        </CollapseItem>
      ))}
    </View>
  );
}

// CollapseItem 组件
export function CollapseItem(props: CollapseItemProps) {
  const {
    itemKey,
    title,
    value,
    disabled = false,
    expanded = false,
    onToggle,
    children,
    className = '',
    style,
  } = props;

  const handleClick = () => {
    if (disabled) return;
    onToggle?.(itemKey);
  };

  const itemClass = [
    'svton-collapse-item',
    disabled ? 'svton-collapse-item--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={itemClass} style={style}>
      <View className="svton-collapse-item__header" onClick={handleClick}>
        <View className="svton-collapse-item__title">{title}</View>
        {value && <View className="svton-collapse-item__value">{value}</View>}
        <Text className={`svton-collapse-item__arrow ${expanded ? 'svton-collapse-item__arrow--expanded' : ''}`}>
          ›
        </Text>
      </View>

      <View
        className="svton-collapse-item__content"
        style={{ height: expanded ? 'auto' : 0 }}
      >
        <View className="svton-collapse-item__body">{children}</View>
      </View>
    </View>
  );
}

export default Collapse;
