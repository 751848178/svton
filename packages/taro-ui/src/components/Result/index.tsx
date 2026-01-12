/**
 * Result 结果页组件
 *
 * 功能特性：
 * - 多种状态（成功、失败、等待、警告、信息）
 * - 自定义图标
 * - 操作按钮
 */
import { ReactNode, CSSProperties } from 'react';
import { View, Text, Image } from '@tarojs/components';
import './index.scss';

export type ResultStatus = 'success' | 'error' | 'warning' | 'info' | 'waiting';

export interface ResultProps {
  /** 状态类型 */
  status?: ResultStatus;
  /** 标题 */
  title?: ReactNode;
  /** 描述 */
  description?: ReactNode;
  /** 自定义图标 */
  icon?: ReactNode;
  /** 图片地址 */
  image?: string;
  /** 图片大小 */
  imageSize?: number;
  /** 操作区 */
  extra?: ReactNode;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

// 默认图标
const STATUS_ICONS: Record<ResultStatus, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
  waiting: '...',
};

export function Result(props: ResultProps) {
  const {
    status = 'info',
    title,
    description,
    icon,
    image,
    imageSize = 200,
    extra,
    children,
    className = '',
    style,
  } = props;

  const resultClass = [
    'svton-result',
    `svton-result--${status}`,
    className,
  ].filter(Boolean).join(' ');

  const renderIcon = () => {
    if (image) {
      return (
        <Image
          className="svton-result__image"
          src={image}
          mode="aspectFit"
          style={{ width: `${imageSize}rpx`, height: `${imageSize}rpx` }}
        />
      );
    }

    if (icon) {
      return <View className="svton-result__icon">{icon}</View>;
    }

    return (
      <View className={`svton-result__icon svton-result__icon--${status}`}>
        <Text>{STATUS_ICONS[status]}</Text>
      </View>
    );
  };

  return (
    <View className={resultClass} style={style}>
      {renderIcon()}

      {title && (
        <View className="svton-result__title">
          <Text>{title}</Text>
        </View>
      )}

      {description && (
        <View className="svton-result__desc">
          <Text>{description}</Text>
        </View>
      )}

      {children && <View className="svton-result__content">{children}</View>}

      {extra && <View className="svton-result__extra">{extra}</View>}
    </View>
  );
}

export default Result;
