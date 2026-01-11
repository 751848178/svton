/**
 * ActionSheet 操作菜单组件
 *
 * 功能特性：
 * - 底部弹出操作菜单
 * - 支持标题和描述
 * - 支持取消按钮
 * - 支持危险操作样式
 * - 支持禁用选项
 */
import React, { CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import { Popup } from '../Popup';
import './index.scss';

export interface ActionSheetItem {
  /** 选项文本 */
  text: string;
  /** 选项描述 */
  description?: string;
  /** 是否为危险操作 */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义颜色 */
  color?: string;
}

export interface ActionSheetProps {
  /** 是否显示 */
  visible: boolean;
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 选项列表 */
  items: ActionSheetItem[];
  /** 取消按钮文本，不传则不显示 */
  cancelText?: string;
  /** 点击遮罩是否关闭 */
  closeOnOverlayClick?: boolean;
  /** 选择回调 */
  onSelect?: (item: ActionSheetItem, index: number) => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 层级 */
  zIndex?: number;
}

export function ActionSheet(props: ActionSheetProps) {
  const {
    visible,
    title,
    description,
    items,
    cancelText = '取消',
    closeOnOverlayClick = true,
    onSelect,
    onCancel,
    onClose,
    className = '',
    style,
    zIndex = 1000,
  } = props;

  const handleSelect = (item: ActionSheetItem, index: number) => {
    if (item.disabled) return;
    onSelect?.(item, index);
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  const hasHeader = !!title || !!description;

  return (
    <Popup
      visible={visible}
      position="bottom"
      round
      closeOnOverlayClick={closeOnOverlayClick}
      onClose={onClose}
      safeAreaInsetBottom
      zIndex={zIndex}
    >
      <View className={`svton-action-sheet ${className}`} style={style}>
        {hasHeader && (
          <View className="svton-action-sheet__header">
            {title && <Text className="svton-action-sheet__title">{title}</Text>}
            {description && <Text className="svton-action-sheet__desc">{description}</Text>}
          </View>
        )}

        <View className="svton-action-sheet__content">
          {items.map((item, index) => (
            <View
              key={index}
              className={`svton-action-sheet__item ${item.danger ? 'svton-action-sheet__item--danger' : ''} ${item.disabled ? 'svton-action-sheet__item--disabled' : ''}`}
              style={item.color ? { color: item.color } : undefined}
              onClick={() => handleSelect(item, index)}
            >
              <Text className="svton-action-sheet__item-text">{item.text}</Text>
              {item.description && (
                <Text className="svton-action-sheet__item-desc">{item.description}</Text>
              )}
            </View>
          ))}
        </View>

        {cancelText && (
          <>
            <View className="svton-action-sheet__gap" />
            <View className="svton-action-sheet__cancel" onClick={handleCancel}>
              <Text>{cancelText}</Text>
            </View>
          </>
        )}
      </View>
    </Popup>
  );
}

export default ActionSheet;
