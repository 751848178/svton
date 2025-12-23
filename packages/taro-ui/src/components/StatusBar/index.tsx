import React, { useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import { systemInfoManager } from '../../utils/systemInfo';
import './index.scss';

interface StatusBarProps {
  backgroundColor?: string;
  className?: string;
}

/**
 * 状态栏占位组件
 * 用于在自定义导航栏或沉浸式设计中占位状态栏高度
 */
export default function StatusBar({ backgroundColor, className = '' }: StatusBarProps) {
  const [height, setHeight] = useState(44);

  useEffect(() => {
    const info = systemInfoManager.getInfo();
    if (info) {
      setHeight(info.statusBarHeight);
    }
  }, []);

  return (
    <View
      className={`status-bar ${className}`}
      style={{
        height: `${height}px`,
        backgroundColor: backgroundColor || 'transparent',
      }}
    />
  );
}
