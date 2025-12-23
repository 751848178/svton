/**
 * ImageGrid 组件
 * 九宫格图片展示，类似朋友圈
 */

import React from 'react';
import { View, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface ImageGridProps {
  images: string[];
  maxCount?: number; // 最多显示几张，默认 9
  onImageClick?: (index: number) => void;
}

export default function ImageGrid({ images, maxCount = 9, onImageClick }: ImageGridProps) {
  const displayImages = images.slice(0, maxCount);
  const count = displayImages.length;

  // 根据图片数量决定布局
  const getGridClass = () => {
    if (count === 1) return 'grid-single';
    if (count === 2 || count === 4) return 'grid-2';
    return 'grid-3';
  };

  const handleImageClick = (index: number) => {
    if (onImageClick) {
      onImageClick(index);
    } else {
      // 默认预览图片
      Taro.previewImage({
        urls: images,
        current: images[index],
      });
    }
  };

  return (
    <View className={`image-grid ${getGridClass()}`}>
      {displayImages.map((url, index) => (
        <View key={index} className="image-item" onClick={() => handleImageClick(index)}>
          <Image
            src={url}
            mode={count === 1 ? 'widthFix' : 'aspectFill'}
            className="image"
            lazyLoad
          />
          {index === maxCount - 1 && images.length > maxCount && (
            <View className="image-overlay">
              <View className="image-count">+{images.length - maxCount + 1}</View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
