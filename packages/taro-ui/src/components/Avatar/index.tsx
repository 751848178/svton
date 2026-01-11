/**
 * Avatar 头像组件
 *
 * 功能特性：
 * - 图片头像
 * - 文字头像
 * - 图标头像
 * - 多种尺寸和形状
 * - 头像组
 */
import React, { ReactNode, CSSProperties, useState } from 'react';
import { View, Image, Text } from '@tarojs/components';
import './index.scss';

export type AvatarSize = 'small' | 'medium' | 'large' | 'xlarge' | number;
export type AvatarShape = 'circle' | 'square';

export interface AvatarProps {
  /** 图片地址 */
  src?: string;
  /** 文字内容 */
  text?: string;
  /** 图标 */
  icon?: ReactNode;
  /** 尺寸 */
  size?: AvatarSize;
  /** 形状 */
  shape?: AvatarShape;
  /** 图片加载失败时的回调 */
  onError?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 背景色 */
  bgColor?: string;
  /** 文字颜色 */
  color?: string;
}

export function Avatar(props: AvatarProps) {
  const {
    src,
    text,
    icon,
    size = 'medium',
    shape = 'circle',
    onError,
    children,
    className = '',
    style,
    bgColor,
    color,
  } = props;

  const [imgError, setImgError] = useState(false);

  const handleError = () => {
    setImgError(true);
    onError?.();
  };

  // 计算尺寸样式
  const sizeStyle: CSSProperties = typeof size === 'number'
    ? { width: `${size}rpx`, height: `${size}rpx`, fontSize: `${size * 0.4}rpx` }
    : {};

  const customStyle: CSSProperties = {
    ...style,
    ...sizeStyle,
    ...(bgColor ? { backgroundColor: bgColor } : {}),
    ...(color ? { color } : {}),
  };

  const avatarClass = [
    'svton-avatar',
    typeof size === 'string' ? `svton-avatar--${size}` : '',
    `svton-avatar--${shape}`,
    className,
  ].filter(Boolean).join(' ');

  // 渲染内容
  const renderContent = () => {
    // 优先显示图片
    if (src && !imgError) {
      return (
        <Image
          className="svton-avatar__image"
          src={src}
          mode="aspectFill"
          onError={handleError}
        />
      );
    }

    // 自定义子元素
    if (children) {
      return children;
    }

    // 图标
    if (icon) {
      return <View className="svton-avatar__icon">{icon}</View>;
    }

    // 文字
    if (text) {
      // 取第一个字符
      const displayText = text.slice(0, 1).toUpperCase();
      return <Text className="svton-avatar__text">{displayText}</Text>;
    }

    // 默认头像
    return <Text className="svton-avatar__default">👤</Text>;
  };

  return (
    <View className={avatarClass} style={customStyle}>
      {renderContent()}
    </View>
  );
}

// 头像组
export interface AvatarGroupProps {
  /** 最大显示数量 */
  max?: number;
  /** 尺寸 */
  size?: AvatarSize;
  /** 形状 */
  shape?: AvatarShape;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function AvatarGroup(props: AvatarGroupProps) {
  const {
    max = 5,
    size = 'medium',
    shape = 'circle',
    children,
    className = '',
    style,
  } = props;

  const childArray = React.Children.toArray(children);
  const displayChildren = childArray.slice(0, max);
  const restCount = childArray.length - max;

  // 计算尺寸
  const sizeValue = typeof size === 'number' ? size : {
    small: 64,
    medium: 96,
    large: 192,
    xlarge: 240,
  }[size];

  return (
    <View className={`svton-avatar-group ${className}`} style={style}>
      {displayChildren.map((child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<AvatarProps>, {
            key: index,
            size,
            shape,
          });
        }
        return child;
      })}

      {restCount > 0 && (
        <View
          className="svton-avatar-group__rest"
          style={{
            width: `${sizeValue}rpx`,
            height: `${sizeValue}rpx`,
            borderRadius: shape === 'circle' ? '50%' : `${sizeValue * 0.2}rpx`,
          }}
        >
          <Text>+{restCount}</Text>
        </View>
      )}
    </View>
  );
}

export default Avatar;
