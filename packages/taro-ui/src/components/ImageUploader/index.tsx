/**
 * ImageUploader 组件
 * 图片上传组件，支持最多 9 张图片
 */

import React, { useState } from 'react';
import { View, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface ImageUploaderProps {
  value?: string[];
  onChange?: (images: string[]) => void;
  maxCount?: number; // 最多上传几张，默认 9
  uploadUrl?: string; // 上传接口地址
}

export default function ImageUploader({
  value = [],
  onChange,
  maxCount = 9,
  uploadUrl = process.env.TARO_APP_API + '/upload/image',
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleChooseImage = async () => {
    try {
      const res = await Taro.chooseImage({
        count: maxCount - value.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });

      setUploading(true);

      // 上传所有图片
      const uploadPromises = res.tempFilePaths.map(async (filePath) => {
        const token = Taro.getStorageSync('token');

        const uploadRes = await Taro.uploadFile({
          url: uploadUrl,
          filePath,
          name: 'file',
          header: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = JSON.parse(uploadRes.data);
        return data.url;
      });

      const urls = await Promise.all(uploadPromises);
      const newImages = [...value, ...urls];
      onChange?.(newImages);

      Taro.showToast({
        title: '上传成功',
        icon: 'success',
      });
    } catch (error: any) {
      Taro.showToast({
        title: error.errMsg || '上传失败',
        icon: 'none',
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = (index: number) => {
    Taro.previewImage({
      urls: value,
      current: value[index],
    });
  };

  const handleDelete = (index: number) => {
    Taro.showModal({
      title: '提示',
      content: '确定删除这张图片吗？',
      success: (res) => {
        if (res.confirm) {
          const newImages = value.filter((_, i) => i !== index);
          onChange?.(newImages);
        }
      },
    });
  };

  return (
    <View className="image-uploader">
      <View className="image-list">
        {value.map((url, index) => (
          <View key={index} className="image-item">
            <Image
              src={url}
              mode="aspectFill"
              className="image"
              onClick={() => handlePreview(index)}
            />
            <View className="delete-btn" onClick={() => handleDelete(index)}>
              ×
            </View>
          </View>
        ))}

        {value.length < maxCount && (
          <View
            className={`add-btn ${uploading ? 'disabled' : ''}`}
            onClick={uploading ? undefined : handleChooseImage}
          >
            {uploading ? (
              <View className="loading">上传中...</View>
            ) : (
              <View className="add-icon">+</View>
            )}
          </View>
        )}
      </View>

      <View className="tip">最多上传 {maxCount} 张图片</View>
    </View>
  );
}
