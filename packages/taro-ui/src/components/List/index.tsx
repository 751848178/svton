/**
 * List 组件 - 功能丰富的列表组件
 *
 * 功能特性：
 * - 下拉刷新
 * - 上拉加载更多
 * - 空状态展示
 * - 多选功能
 * - 自定义渲染
 * - 加载状态
 */
import React, { ReactNode, CSSProperties } from 'react';
import { View, ScrollView, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro';
import './index.scss';

export interface ListProps<T = any> {
  /** 列表数据 */
  data: T[];
  /** 自定义渲染列表项 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 唯一键提取函数 */
  keyExtractor?: (item: T, index: number) => string | number;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否还有更多数据 */
  hasMore?: boolean;
  /** 下拉刷新回调 */
  onRefresh?: () => Promise<void> | void;
  /** 上拉加载更多回调 */
  onLoadMore?: () => Promise<void> | void;
  /** 空状态渲染 */
  renderEmpty?: () => ReactNode;
  /** 空状态提示文本 */
  emptyText?: string;
  /** 加载更多提示文本 */
  loadingText?: string;
  /** 没有更多数据提示文本 */
  noMoreText?: string;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 是否启用下拉刷新 */
  enableRefresh?: boolean;
  /** 是否启用上拉加载 */
  enableLoadMore?: boolean;
  /** 头部内容 */
  header?: ReactNode;
  /** 底部内容 */
  footer?: ReactNode;
}

export function List<T = any>(props: ListProps<T>) {
  const {
    data,
    renderItem,
    keyExtractor = (_, index) => String(index),
    loading = false,
    hasMore = true,
    onRefresh,
    onLoadMore,
    renderEmpty,
    emptyText = '暂无数据',
    loadingText = '加载中...',
    noMoreText = '没有更多了',
    className = '',
    style,
    enableRefresh = true,
    enableLoadMore = true,
    header,
    footer,
  } = props;

  // 下拉刷新
  usePullDownRefresh(async () => {
    if (!enableRefresh || !onRefresh) {
      Taro.stopPullDownRefresh();
      return;
    }

    try {
      await onRefresh?.();
    } finally {
      Taro.stopPullDownRefresh();
    }
  });

  // 上拉加载更多
  useReachBottom(async () => {
    if (!enableLoadMore || !hasMore || loading || !onLoadMore) return;

    await onLoadMore?.();
  });

  // 空状态
  const renderEmptyContent = () => {
    if (renderEmpty) {
      return renderEmpty();
    }

    return (
      <View className="svton-list__empty">
        <Text className="svton-list__empty-text">{emptyText}</Text>
      </View>
    );
  };

  // 加载提示
  const renderLoadingTip = () => {
    if (!loading && !hasMore) {
      return (
        <View className="svton-list__tip svton-list__tip--no-more">
          <Text>{noMoreText}</Text>
        </View>
      );
    }

    if (loading && data.length > 0) {
      return (
        <View className="svton-list__tip svton-list__tip--loading">
          <Text>{loadingText}</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView className={`svton-list ${className}`} style={style} scrollY enableBackToTop>
      {header && <View className="svton-list__header">{header}</View>}

      {data.length === 0 && !loading ? (
        renderEmptyContent()
      ) : (
        <View className="svton-list__content">
          {data.map((item, index) => (
            <View key={keyExtractor(item, index)} className="svton-list__item">
              {renderItem(item, index)}
            </View>
          ))}
        </View>
      )}

      {renderLoadingTip()}

      {footer && <View className="svton-list__footer">{footer}</View>}
    </ScrollView>
  );
}

export default List;
