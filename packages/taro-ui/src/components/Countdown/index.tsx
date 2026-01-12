/**
 * Countdown 倒计时组件
 *
 * 功能特性：
 * - 毫秒级精度
 * - 自定义格式
 * - 自动开始/手动控制
 */
import { useState, useEffect, useRef, CSSProperties, ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

export interface CountdownProps {
  /** 倒计时时长（毫秒） */
  time: number;
  /** 格式化字符串 DD-HH:mm:ss:SSS */
  format?: string;
  /** 是否自动开始 */
  autoStart?: boolean;
  /** 是否显示毫秒 */
  millisecond?: boolean;
  /** 倒计时变化回调 */
  onChange?: (timeData: TimeData) => void;
  /** 倒计时结束回调 */
  onFinish?: () => void;
  /** 自定义渲染 */
  children?: (timeData: TimeData) => ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export interface TimeData {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}

// 解析时间
const parseTime = (time: number): TimeData => {
  const days = Math.floor(time / (1000 * 60 * 60 * 24));
  const hours = Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((time % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((time % (1000 * 60)) / 1000);
  const milliseconds = time % 1000;

  return { days, hours, minutes, seconds, milliseconds };
};

// 补零
const padZero = (num: number, length = 2): string => {
  return String(num).padStart(length, '0');
};

// 格式化时间
const formatTime = (timeData: TimeData, format: string): string => {
  let result = format;

  if (result.includes('DD')) {
    result = result.replace('DD', padZero(timeData.days));
  } else {
    // 如果没有天数，把天数加到小时
    timeData.hours += timeData.days * 24;
  }

  result = result.replace('HH', padZero(timeData.hours));
  result = result.replace('mm', padZero(timeData.minutes));
  result = result.replace('ss', padZero(timeData.seconds));
  result = result.replace('SSS', padZero(timeData.milliseconds, 3));
  result = result.replace('SS', padZero(Math.floor(timeData.milliseconds / 10)));
  result = result.replace('S', String(Math.floor(timeData.milliseconds / 100)));

  return result;
};

export function Countdown(props: CountdownProps) {
  const {
    time,
    format = 'HH:mm:ss',
    autoStart = true,
    millisecond = false,
    onChange,
    onFinish,
    children,
    className = '',
    style,
  } = props;

  const [remain, setRemain] = useState(time);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<any>(null);
  const endTimeRef = useRef<number>(0);

  // 开始倒计时
  const start = () => {
    if (running) return;
    setRunning(true);
    endTimeRef.current = Date.now() + remain;
    tick();
  };

  // 暂停
  const pause = () => {
    setRunning(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 重置
  const reset = (newTime?: number) => {
    pause();
    setRemain(newTime ?? time);
  };

  // 计时
  const tick = () => {
    const now = Date.now();
    const newRemain = Math.max(0, endTimeRef.current - now);
    setRemain(newRemain);

    if (newRemain === 0) {
      setRunning(false);
      onFinish?.();
      return;
    }

    const interval = millisecond ? 30 : 1000;
    timerRef.current = setTimeout(tick, interval);
  };

  // 自动开始
  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // 时间变化回调
  useEffect(() => {
    const timeData = parseTime(remain);
    onChange?.(timeData);
  }, [remain]);

  // 重置时间
  useEffect(() => {
    if (!running) {
      setRemain(time);
    }
  }, [time]);

  const timeData = parseTime(remain);
  const formattedTime = formatTime(timeData, format);

  const countdownClass = [
    'svton-countdown',
    className,
  ].filter(Boolean).join(' ');

  return (
    <View className={countdownClass} style={style}>
      {children ? children(timeData) : <Text>{formattedTime}</Text>}
    </View>
  );
}

export default Countdown;
