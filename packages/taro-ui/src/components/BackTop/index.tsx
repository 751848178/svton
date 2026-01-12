/**
 * BackTop 返回顶部组件
 *
 * 功能特性：
 * - 滚动显示/隐藏
 * - 自定义图标
 * - 自定义位置
 */
import { useState, useEffect, ReactNode, CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export interface BackTopProps {
  /** 滚动高度达到此值时显示 */
  visibilityHeight?: number;
  /** 距离右边距离 */
  right?: number;
  /** 距离底部距离 */
  bottom?: number;
  /** 自定义图标 */
  icon?: ReactNode;
  /** 自定义文字 */
  text?: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 子元素 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function BackTop(props: BackTopProps) {
  const {
    visibilityHeight = 200,
    right = 32,
    bottom = 160,
    icon,
    text,
    onClick,
    children,
    className = '',
    style,
  } = props;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      Taro.createSelectorQuery()
        .selectViewport()
        .scrollOffset()
        .exec((res) => {
          if (res[0]) {
            setVisible(res[0].scrollTop >= visibilityHeight);
          }
        });
    };

    // 监听页面滚动
    Taro.eventCenter.on('pageScroll', handleScroll);

    return () => {
      Taro.eventCenter.off('pageScroll', handleScroll);
    };
  }, [visibilityHeight]);

  const handleClick = () => {
    Taro.pageScrollTo({
      scrollTop: 0,
      duration: 300,
    });
    onClick?.();
  };

  if (!visible) return null;

  const backTopClass = [
    'svton-back-top',
    className,
  ].filter(Boolean).join(' ');

  const backTopStyle: CSSProperties = {
    right: `${right}rpx`,
    bottom: `${bottom}rpx`,
    ...style,
  };

  return (
    <View className={backTopClass} style={backTopStyle} onClick={handleClick}>
      {children || (
        <>
          {icon || <Text className="svton-back-top__icon">↑</Text>}
          {text && <Text className="svton-back-top__text">{text}</Text>}
        </>
      )}
    </View>
  );
}

export default BackTop;
