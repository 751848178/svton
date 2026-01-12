/**
 * Steps 步骤条组件
 *
 * 功能特性：
 * - 水平/垂直方向
 * - 自定义图标
 * - 错误状态
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type StepsDirection = 'horizontal' | 'vertical';
export type StepStatus = 'wait' | 'process' | 'finish' | 'error';

export interface StepItem {
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: ReactNode;
  /** 状态 */
  status?: StepStatus;
}

export interface StepsProps {
  /** 当前步骤（从 0 开始） */
  current?: number;
  /** 方向 */
  direction?: StepsDirection;
  /** 步骤数据 */
  items: StepItem[];
  /** 点击回调 */
  onClick?: (index: number) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Steps(props: StepsProps) {
  const {
    current = 0,
    direction = 'horizontal',
    items,
    onClick,
    className = '',
    style,
  } = props;

  const getStatus = (index: number, item: StepItem): StepStatus => {
    if (item.status) return item.status;
    if (index < current) return 'finish';
    if (index === current) return 'process';
    return 'wait';
  };

  const getIcon = (index: number, status: StepStatus, item: StepItem) => {
    if (item.icon) return item.icon;
    if (status === 'finish') return '✓';
    if (status === 'error') return '✕';
    return index + 1;
  };

  const stepsClass = [
    'svton-steps',
    `svton-steps--${direction}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={stepsClass} style={style}>
      {items.map((item, index) => {
        const status = getStatus(index, item);
        const isActive = status === 'process';
        const isFinish = status === 'finish';
        const isError = status === 'error';

        return (
          <View
            key={index}
            className="svton-step"
            onClick={() => onClick?.(index)}
          >
            <View
              className={`svton-step__icon ${isActive ? 'svton-step__icon--active' : ''} ${isFinish ? 'svton-step__icon--finish' : ''} ${isError ? 'svton-step__icon--error' : ''}`}
            >
              <Text>{getIcon(index, status, item)}</Text>
            </View>

            <View
              className={`svton-step__line ${index < current ? 'svton-step__line--active' : ''}`}
            />

            <View className="svton-step__content">
              <Text
                className={`svton-step__title ${isActive ? 'svton-step__title--active' : ''} ${isFinish ? 'svton-step__title--finish' : ''} ${isError ? 'svton-step__title--error' : ''}`}
              >
                {item.title}
              </Text>
              {item.description && (
                <Text className="svton-step__desc">{item.description}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default Steps;
