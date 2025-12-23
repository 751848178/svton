/**
 * TabBar 组件 - 通用的Tab切换组件
 *
 * 功能特性：
 * - 动态Tab项配置
 * - 自动计算下划线位置
 * - 支持受控/非受控模式
 * - 自定义样式
 * - 切换动画
 */
import React, { CSSProperties, ReactNode, useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export interface TabBarItem<T = string> {
  /** Tab 的唯一标识 */
  key: T;
  /** 显示文本 */
  label: string;
  /** 自定义渲染内容 */
  render?: () => ReactNode;
  /** 是否禁用 */
  disabled?: boolean;
}

export interface TabBarProps<T = string> {
  /** Tab 项列表 */
  items: TabBarItem<T>[];
  /** 当前激活的Tab（受控） */
  activeKey?: T;
  /** 默认激活的Tab（非受控） */
  defaultActiveKey?: T;
  /** Tab 切换回调 */
  onChange?: (key: T) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 下划线宽度 */
  indicatorWidth?: number;
  /** 是否显示下划线 */
  showIndicator?: boolean;
  /** 是否粘性定位 */
  sticky?: boolean;
}

export function TabBar<T extends string = string>(props: TabBarProps<T>) {
  const {
    items,
    activeKey: controlledActiveKey,
    defaultActiveKey,
    onChange,
    className = '',
    style,
    indicatorWidth = 48,
    showIndicator = true,
    sticky = true,
  } = props;

  // 受控/非受控状态
  const [internalActiveKey, setInternalActiveKey] = useState<T>(defaultActiveKey || items[0]?.key);

  const activeKey = controlledActiveKey !== undefined ? controlledActiveKey : internalActiveKey;

  // 计算当前激活Tab的索引
  const activeIndex = items.findIndex((item) => item.key === activeKey);

  // 计算下划线位置
  const indicatorLeft = items.length > 0 ? `${(activeIndex + 0.5) * (100 / items.length)}%` : '50%';

  // 切换Tab
  const handleTabChange = usePersistFn((key: T, disabled?: boolean) => {
    if (disabled) return;

    if (controlledActiveKey === undefined) {
      setInternalActiveKey(key);
    }

    onChange?.(key);
  });

  // 同步外部的 activeKey
  useEffect(() => {
    if (controlledActiveKey !== undefined) {
      setInternalActiveKey(controlledActiveKey);
    }
  }, [controlledActiveKey]);

  return (
    <View className={`svton-tab-bar ${sticky ? 'sticky' : ''} ${className}`} style={style}>
      <View className="svton-tab-bar__list">
        {items.map((item) => (
          <View
            key={item.key}
            className={`svton-tab-bar__item ${
              activeKey === item.key ? 'active' : ''
            } ${item.disabled ? 'disabled' : ''}`}
            onClick={() => handleTabChange(item.key, item.disabled)}
          >
            {item.render ? (
              item.render()
            ) : (
              <Text className="svton-tab-bar__text">{item.label}</Text>
            )}
          </View>
        ))}
      </View>

      {showIndicator && items.length > 0 && (
        <View className="svton-tab-bar__indicator-wrapper">
          <View
            className="svton-tab-bar__indicator"
            style={{
              left: indicatorLeft,
              width: `${indicatorWidth}px`,
              marginLeft: `-${indicatorWidth / 2}px`,
            }}
          />
        </View>
      )}
    </View>
  );
}

export default TabBar;
