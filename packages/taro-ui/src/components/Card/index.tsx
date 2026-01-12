/**
 * Card 卡片组件
 *
 * 功能特性：
 * - 标题和副标题
 * - 封面图
 * - 操作区
 * - 多种样式
 */
import { ReactNode, CSSProperties } from 'react';
import { View, Text, Image } from '@tarojs/components';
import './index.scss';

export interface CardProps {
  /** 标题 */
  title?: ReactNode;
  /** 副标题 */
  subtitle?: ReactNode;
  /** 封面图 */
  cover?: string;
  /** 封面图高度 */
  coverHeight?: number;
  /** 头部右侧内容 */
  extra?: ReactNode;
  /** 底部操作区 */
  footer?: ReactNode;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否显示阴影 */
  shadow?: boolean;
  /** 是否可点击 */
  clickable?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Card(props: CardProps) {
  const {
    title,
    subtitle,
    cover,
    coverHeight = 300,
    extra,
    footer,
    bordered = false,
    shadow = true,
    clickable = false,
    onClick,
    children,
    className = '',
    style,
  } = props;

  const hasHeader = title || subtitle || extra;

  const cardClass = [
    'svton-card',
    bordered ? 'svton-card--bordered' : '',
    shadow ? 'svton-card--shadow' : '',
    clickable ? 'svton-card--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={cardClass} style={style} onClick={clickable ? onClick : undefined}>
      {cover && (
        <View className="svton-card__cover">
          <Image
            className="svton-card__cover-image"
            src={cover}
            mode="aspectFill"
            style={{ height: `${coverHeight}rpx` }}
          />
        </View>
      )}

      {hasHeader && (
        <View className="svton-card__header">
          <View className="svton-card__header-content">
            {title && <Text className="svton-card__title">{title}</Text>}
            {subtitle && <Text className="svton-card__subtitle">{subtitle}</Text>}
          </View>
          {extra && <View className="svton-card__extra">{extra}</View>}
        </View>
      )}

      {children && <View className="svton-card__body">{children}</View>}

      {footer && <View className="svton-card__footer">{footer}</View>}
    </View>
  );
}

export default Card;
