/**
 * Tabs 标签页组件
 * @svton/taro-ui
 * 
 * 优化说明：
 * - onClick 通过 data-* 属性传递 key，避免每次渲染创建新函数
 * - 使用事件委托模式，单个 onChange 处理所有 tab 点击
 */

import { View, Text } from '@tarojs/components';
import { ReactNode } from 'react';
import './index.scss';

export interface TabItem {
  key: string;
  label: string;
  count?: number; // 可选的徽标数字
}

export interface TabsProps {
  /**
   * 当前激活的 tab key
   */
  activeKey: string;
  /**
   * tab 列表
   */
  items: TabItem[];
  /**
   * tab 切换回调
   * @param key - 被点击的 tab key
   */
  onChange: (key: string) => void;
  /**
   * 自定义类名
   */
  className?: string;
}

export function Tabs({ activeKey, items, onChange, className = '' }: TabsProps) {
  // 统一的点击处理函数，从事件中获取 key
  const handleItemClick = (e: any) => {
    const key = e.currentTarget.dataset.key;
    if (key && key !== activeKey) {
      onChange(key);
    }
  };

  return (
    <View className={`svton-tabs ${className}`}>
      {items.map((item) => (
        <View
          key={item.key}
          data-key={item.key}
          className={`svton-tabs__item ${activeKey === item.key ? 'svton-tabs__item--active' : ''}`}
          onClick={handleItemClick}
        >
          <Text className="svton-tabs__label">{item.label}</Text>
          {item.count !== undefined && <Text className="svton-tabs__count">({item.count})</Text>}
        </View>
      ))}
    </View>
  );
}

export default Tabs;
