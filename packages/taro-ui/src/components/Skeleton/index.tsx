/**
 * Skeleton 骨架屏组件
 *
 * 功能特性：
 * - 头像占位
 * - 标题占位
 * - 段落占位
 * - 动画效果
 * - 自定义行数和宽度
 */
import React, { CSSProperties } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

export type SkeletonAvatarSize = 'small' | 'medium' | 'large';
export type SkeletonAvatarShape = 'circle' | 'square';

export interface SkeletonProps {
  /** 是否显示头像占位 */
  avatar?: boolean;
  /** 头像尺寸 */
  avatarSize?: SkeletonAvatarSize;
  /** 头像形状 */
  avatarShape?: SkeletonAvatarShape;
  /** 是否显示标题占位 */
  title?: boolean;
  /** 标题宽度 */
  titleWidth?: string | number;
  /** 段落行数 */
  rows?: number;
  /** 每行宽度，可以是数组 */
  rowsWidth?: (string | number)[];
  /** 是否显示动画 */
  animate?: boolean;
  /** 是否圆角 */
  round?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 子元素（加载完成后显示） */
  children?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Skeleton(props: SkeletonProps) {
  const {
    avatar = false,
    avatarSize = 'medium',
    avatarShape = 'circle',
    title = true,
    titleWidth = '40%',
    rows = 3,
    rowsWidth,
    animate = true,
    round = false,
    loading = true,
    children,
    className = '',
    style,
  } = props;

  // 加载完成，显示内容
  if (!loading) {
    return <>{children}</>;
  }

  // 计算每行宽度
  const getRowWidth = (index: number): string => {
    if (rowsWidth && rowsWidth[index] !== undefined) {
      const width = rowsWidth[index];
      return typeof width === 'number' ? `${width}%` : width;
    }
    // 最后一行默认 60%
    if (index === rows - 1) {
      return '60%';
    }
    return '100%';
  };

  const skeletonClass = [
    'svton-skeleton',
    animate ? 'svton-skeleton--animate' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={skeletonClass} style={style}>
      {avatar && (
        <View
          className={`svton-skeleton__avatar svton-skeleton__avatar--${avatarSize} svton-skeleton__avatar--${avatarShape}`}
        />
      )}

      <View className="svton-skeleton__content">
        {title && (
          <View
            className={`svton-skeleton__title ${round ? 'svton-skeleton__title--round' : ''}`}
            style={{ width: typeof titleWidth === 'number' ? `${titleWidth}%` : titleWidth }}
          />
        )}

        {Array.from({ length: rows }).map((_, index) => (
          <View
            key={index}
            className={`svton-skeleton__row ${round ? 'svton-skeleton__row--round' : ''}`}
            style={{ width: getRowWidth(index) }}
          />
        ))}
      </View>
    </View>
  );
}

// 骨架屏图片
export interface SkeletonImageProps {
  /** 宽度 */
  width?: string | number;
  /** 高度 */
  height?: string | number;
  /** 是否显示动画 */
  animate?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function SkeletonImage(props: SkeletonImageProps) {
  const {
    width = '100%',
    height = '200rpx',
    animate = true,
    className = '',
    style,
  } = props;

  return (
    <View
      className={`svton-skeleton-image ${animate ? 'svton-skeleton-image--animate' : ''} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}rpx` : width,
        height: typeof height === 'number' ? `${height}rpx` : height,
        ...style,
      }}
    />
  );
}

export default Skeleton;
