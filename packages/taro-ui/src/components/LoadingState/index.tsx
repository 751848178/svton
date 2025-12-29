import React, { CSSProperties, ReactNode } from 'react';
import { View, Text } from '@tarojs/components';

import './index.scss';

export interface LoadingStateProps {
  text?: ReactNode;
  spinner?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function LoadingState(props: LoadingStateProps) {
  const { text = '加载中...', spinner = true, className = '', style } = props;

  return (
    <View className={`svton-loading-state ${className}`.trim()} style={style}>
      {spinner && <View className="svton-loading-state__spinner" />}
      {text ? <Text className="svton-loading-state__text">{text}</Text> : null}
    </View>
  );
}

export const Loading = LoadingState;
