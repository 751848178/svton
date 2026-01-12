/**
 * SwipeCell 滑动单元格组件
 *
 * 功能特性：
 * - 左滑/右滑操作
 * - 自定义操作按钮
 * - 点击关闭
 */
import React, { useState, useRef, ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import { usePersistFn } from '@svton/hooks';
import './index.scss';

export interface SwipeCellAction {
  /** 按钮文本 */
  text: string;
  /** 按钮类型 */
  type?: 'primary' | 'danger' | 'warning' | 'default';
  /** 背景色 */
  bgColor?: string;
  /** 文字颜色 */
  color?: string;
  /** 宽度 */
  width?: number;
  /** 点击回调 */
  onClick?: () => void;
}

export interface SwipeCellProps {
  /** 左侧操作按钮 */
  leftActions?: SwipeCellAction[];
  /** 右侧操作按钮 */
  rightActions?: SwipeCellAction[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 打开前回调，返回 false 阻止打开 */
  beforeOpen?: (position: 'left' | 'right') => boolean | Promise<boolean>;
  /** 打开回调 */
  onOpen?: (position: 'left' | 'right') => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function SwipeCell(props: SwipeCellProps) {
  const {
    leftActions = [],
    rightActions = [],
    disabled = false,
    beforeOpen,
    onOpen,
    onClose,
    children,
    className = '',
    style,
  } = props;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);

  // 计算操作区宽度
  const leftWidth = leftActions.reduce((sum, action) => sum + (action.width || 80), 0);
  const rightWidth = rightActions.reduce((sum, action) => sum + (action.width || 80), 0);

  const handleTouchStart = usePersistFn((e: any) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
    setDragging(true);
  });

  const handleTouchMove = usePersistFn((e: any) => {
    if (disabled || !dragging) return;

    const deltaX = e.touches[0].clientX - startX.current;
    let newOffset = startOffset.current + deltaX;

    // 限制滑动范围
    if (newOffset > leftWidth) {
      newOffset = leftWidth + (newOffset - leftWidth) * 0.3;
    } else if (newOffset < -rightWidth) {
      newOffset = -rightWidth + (newOffset + rightWidth) * 0.3;
    }

    setOffset(newOffset);
  });

  const handleTouchEnd = usePersistFn(async () => {
    if (disabled) return;
    setDragging(false);

    const threshold = 40; // 触发阈值

    if (offset > threshold && leftActions.length > 0) {
      // 打开左侧
      if (beforeOpen) {
        const canOpen = await beforeOpen('left');
        if (!canOpen) {
          setOffset(0);
          return;
        }
      }
      setOffset(leftWidth);
      onOpen?.('left');
    } else if (offset < -threshold && rightActions.length > 0) {
      // 打开右侧
      if (beforeOpen) {
        const canOpen = await beforeOpen('right');
        if (!canOpen) {
          setOffset(0);
          return;
        }
      }
      setOffset(-rightWidth);
      onOpen?.('right');
    } else {
      // 关闭
      setOffset(0);
      if (startOffset.current !== 0) {
        onClose?.();
      }
    }
  });

  const handleActionClick = usePersistFn((action: SwipeCellAction) => {
    action.onClick?.();
    setOffset(0);
    onClose?.();
  });

  const close = usePersistFn(() => {
    setOffset(0);
    onClose?.();
  });

  const renderActions = (actions: SwipeCellAction[], position: 'left' | 'right') => {
    if (actions.length === 0) return null;

    return (
      <View className={`svton-swipe-cell__actions svton-swipe-cell__actions--${position}`}>
        {actions.map((action, index) => {
          const actionStyle: CSSProperties = {
            width: `${action.width || 80}px`,
            ...(action.bgColor ? { backgroundColor: action.bgColor } : {}),
            ...(action.color ? { color: action.color } : {}),
          };

          return (
            <View
              key={index}
              className={`svton-swipe-cell__action svton-swipe-cell__action--${action.type || 'default'}`}
              style={actionStyle}
              onClick={() => handleActionClick(action)}
            >
              <Text>{action.text}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const swipeCellClass = [
    'svton-swipe-cell',
    disabled ? 'svton-swipe-cell--disabled' : '',
    className,
  ].filter(Boolean).join(' ');

  const contentStyle: CSSProperties = {
    transform: `translateX(${offset}px)`,
    transition: dragging ? 'none' : 'transform 0.3s ease',
  };

  return (
    <View className={swipeCellClass} style={style}>
      {renderActions(leftActions, 'left')}

      <View
        className="svton-swipe-cell__content"
        style={contentStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={offset !== 0 ? close : undefined}
      >
        {children}
      </View>

      {renderActions(rightActions, 'right')}
    </View>
  );
}

export default SwipeCell;
