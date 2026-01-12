/**
 * Grid 宫格组件
 *
 * 功能特性：
 * - 自定义列数
 * - 正方形格子
 * - 边框样式
 * - 自定义内容
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, Text, Image } from '@tarojs/components';
import './index.scss';

export interface GridItem {
  /** 图标 */
  icon?: ReactNode;
  /** 图片地址 */
  image?: string;
  /** 文字 */
  text?: string;
  /** 描述 */
  description?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义内容 */
  content?: ReactNode;
}

export interface GridProps {
  /** 列数 */
  columns?: number;
  /** 是否显示边框 */
  border?: boolean;
  /** 是否正方形 */
  square?: boolean;
  /** 是否居中 */
  center?: boolean;
  /** 格子间距 */
  gutter?: number;
  /** 格子数据 */
  items?: GridItem[];
  /** 点击回调 */
  onClick?: (item: GridItem, index: number) => void;
  /** 自定义渲染 */
  renderItem?: (item: GridItem, index: number) => ReactNode;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Grid(props: GridProps) {
  const {
    columns = 4,
    border = true,
    square = false,
    center = true,
    gutter = 0,
    items = [],
    onClick,
    renderItem,
    children,
    className = '',
    style,
  } = props;

  const gridClass = [
    'svton-grid',
    border ? 'svton-grid--border' : '',
    square ? 'svton-grid--square' : '',
    center ? 'svton-grid--center' : '',
    className,
  ].filter(Boolean).join(' ');

  const gridStyle: CSSProperties = {
    ...style,
    ...(gutter ? { gap: `${gutter}rpx` } : {}),
  };

  const itemWidth = `${100 / columns}%`;

  const handleClick = (item: GridItem, index: number) => {
    if (item.disabled) return;
    onClick?.(item, index);
  };

  // 使用 children 或 items
  if (children) {
    return (
      <View className={gridClass} style={gridStyle}>
        {children}
      </View>
    );
  }

  return (
    <View className={gridClass} style={gridStyle}>
      {items.map((item, index) => {
        const itemStyle: CSSProperties = {
          width: itemWidth,
          ...(square ? { paddingTop: itemWidth } : {}),
        };

        return (
          <View
            key={index}
            className={`svton-grid-item ${item.disabled ? 'svton-grid-item--disabled' : ''}`}
            style={itemStyle}
          >
            <View
              className="svton-grid-item__content"
              onClick={() => handleClick(item, index)}
            >
              {renderItem ? (
                renderItem(item, index)
              ) : (
                <>
                  {item.content || (
                    <>
                      {item.icon && <View className="svton-grid-item__icon">{item.icon}</View>}
                      {item.image && (
                        <Image
                          className="svton-grid-item__image"
                          src={item.image}
                          mode="aspectFill"
                        />
                      )}
                      {item.text && <Text className="svton-grid-item__text">{item.text}</Text>}
                      {item.description && (
                        <Text className="svton-grid-item__desc">{item.description}</Text>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// GridItem 组件（用于自定义子元素）
export interface GridItemProps {
  /** 图标 */
  icon?: ReactNode;
  /** 图片地址 */
  image?: string;
  /** 文字 */
  text?: string;
  /** 描述 */
  description?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function GridItem(props: GridItemProps) {
  const {
    icon,
    image,
    text,
    description,
    disabled = false,
    onClick,
    children,
    className = '',
    style,
  } = props;

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
  };

  return (
    <View
      className={`svton-grid-item ${disabled ? 'svton-grid-item--disabled' : ''} ${className}`}
      style={style}
    >
      <View className="svton-grid-item__content" onClick={handleClick}>
        {children || (
          <>
            {icon && <View className="svton-grid-item__icon">{icon}</View>}
            {image && (
              <Image className="svton-grid-item__image" src={image} mode="aspectFill" />
            )}
            {text && <Text className="svton-grid-item__text">{text}</Text>}
            {description && <Text className="svton-grid-item__desc">{description}</Text>}
          </>
        )}
      </View>
    </View>
  );
}

export default Grid;
