import React, { CSSProperties, ReactNode } from 'react';
import { View, Text } from '@tarojs/components';

import './index.scss';

export interface EmptyStateProps {
  text?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function EmptyState(props: EmptyStateProps) {
  const { text = '暂无内容', description, action, className = '', style } = props;

  return (
    <View className={`svton-empty-state ${className}`.trim()} style={style}>
      <Text className="svton-empty-state__title">{text}</Text>
      {description ? <Text className="svton-empty-state__desc">{description}</Text> : null}
      {action ? <View className="svton-empty-state__action">{action}</View> : null}
    </View>
  );
}

export const Empty = EmptyState;
