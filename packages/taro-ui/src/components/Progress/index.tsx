/**
 * Progress 进度条组件
 *
 * 功能特性：
 * - 线性进度条
 * - 环形进度条
 * - 自定义颜色和尺寸
 * - 显示百分比
 */
import React, { CSSProperties } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export type ProgressType = 'line' | 'circle';
export type ProgressStatus = 'normal' | 'success' | 'error';

export interface ProgressProps {
  /** 进度百分比 0-100 */
  percent: number;
  /** 类型 */
  type?: ProgressType;
  /** 状态 */
  status?: ProgressStatus;
  /** 进度条粗细 */
  strokeWidth?: number;
  /** 进度条颜色 */
  color?: string;
  /** 轨道颜色 */
  trackColor?: string;
  /** 是否显示文字 */
  showText?: boolean;
  /** 自定义文字 */
  text?: string;
  /** 环形进度条直径 */
  size?: number;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Progress(props: ProgressProps) {
  const {
    percent,
    type = 'line',
    status = 'normal',
    strokeWidth = 8,
    color,
    trackColor,
    showText = true,
    text,
    size = 100,
    className = '',
    style,
  } = props;

  // 限制百分比范围
  const validPercent = Math.min(100, Math.max(0, percent));

  // 获取状态颜色
  const getStatusColor = () => {
    if (color) return color;
    switch (status) {
      case 'success': return '#52c41a';
      case 'error': return '#ff4d4f';
      default: return '#1890ff';
    }
  };

  const progressColor = getStatusColor();
  const displayText = text ?? `${validPercent}%`;

  if (type === 'circle') {
    // 环形进度条
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (validPercent / 100) * circumference;

    return (
      <View className={`svton-progress svton-progress--circle ${className}`} style={style}>
        <View
          className="svton-progress__circle"
          style={{ width: `${size}rpx`, height: `${size}rpx` }}
        >
          <View className="svton-progress__circle-svg">
            {/* 轨道 */}
            <View
              className="svton-progress__circle-track"
              style={{
                width: `${size - strokeWidth * 2}rpx`,
                height: `${size - strokeWidth * 2}rpx`,
                borderWidth: `${strokeWidth}rpx`,
                borderColor: trackColor || '#f0f0f0',
              }}
            />
            {/* 进度 - 使用伪元素模拟 */}
            <View
              className="svton-progress__circle-bar"
              style={{
                width: `${size}rpx`,
                height: `${size}rpx`,
                background: `conic-gradient(${progressColor} ${validPercent * 3.6}deg, transparent 0deg)`,
                mask: `radial-gradient(transparent ${radius - strokeWidth}rpx, #000 ${radius - strokeWidth}rpx)`,
                WebkitMask: `radial-gradient(transparent ${radius - strokeWidth}rpx, #000 ${radius - strokeWidth}rpx)`,
              }}
            />
          </View>
          {showText && (
            <View className="svton-progress__circle-text">
              <Text>{displayText}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // 线性进度条
  return (
    <View className={`svton-progress svton-progress--line ${className}`} style={style}>
      <View className="svton-progress__line">
        <View
          className="svton-progress__track"
          style={{
            height: `${strokeWidth}rpx`,
            backgroundColor: trackColor || '#f0f0f0',
          }}
        >
          <View
            className="svton-progress__bar"
            style={{
              width: `${validPercent}%`,
              height: `${strokeWidth}rpx`,
              backgroundColor: progressColor,
            }}
          />
        </View>
      </View>
      {showText && (
        <View className="svton-progress__text">
          <Text>{displayText}</Text>
        </View>
      )}
    </View>
  );
}

export default Progress;
