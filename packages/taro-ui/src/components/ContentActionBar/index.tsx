import React, { useState } from 'react';
import { View, Text, Textarea, Image } from '@tarojs/components';
import './index.scss';

// 图标 URL（与评论区保持一致）
const ICONS = {
  // 点赞图标（未点赞） - 空心心形
  like: 'https://miaoduo.fbcontent.cn/private/resource/image/19a9ba374ebbee0-0aa9c734-e868-4861-9bfd-37de7ed3a123.svg',
  // 点赞图标（已点赞） - 实心红色心形
  liked: 'https://miaoduo.fbcontent.cn/private/resource/image/19a9d0909e270e7-fdf153f2-b3d2-4800-a63a-213c242beed8.svg',
  // 收藏图标（未收藏） - 星形
  favorite: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTIgMi41TDE1LjA5IDguMjZMMjEuMTggOS4yN0wxNi41OSAxMy45N0wxNy42NCAyMEwxMiAxNy4yN0w2LjM2IDIwTDcuNDEgMTMuOTdMMi44MiA5LjI3TDguOTEgOC4yNkwxMiAyLjV6IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+',
  // 收藏图标（已收藏） - 金黄色星形
  favorited: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTIgMi41TDE1LjA5IDguMjZMMjEuMTggOS4yN0wxNi41OSAxMy45N0wxNy42NCAyMEwxMiAxNy4yN0w2LjM2IDIwTDcuNDEgMTMuOTdMMi44MiA5LjI3TDguOTEgOC4yNkwxMiAyLjV6IiBmaWxsPSIjRkZDQzAwIiBzdHJva2U9IiNGRkNDMDAiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+',
  // 分享图标
  share: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxOCIgY3k9IjUiIHI9IjMiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8Y2lyY2xlIGN4PSI2IiBjeT0iMTIiIHI9IjMiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8Y2lyY2xlIGN4PSIxOCIgY3k9IjE5IiByPSIzIiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMS41Ii8+CiAgPHBhdGggZD0iTTguNTkgMTMuNTFMMTUuNDIgMTcuNDlNMTUuNDEgNi41MUw4LjU5IDEwLjQ5IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMS41Ii8+Cjwvc3ZnPg==',
};

export interface ContentActionBarProps {
  /** 评论回调 */
  onComment?: (content: string) => void | Promise<void>;
  /** 点赞回调 */
  onLike?: () => void;
  /** 收藏回调 */
  onFavorite?: () => void;
  /** 分享回调 */
  onShare?: () => void;
  /** 是否已点赞 */
  liked?: boolean;
  /** 是否已收藏 */
  favorited?: boolean;
  /** 输入框占位文字 */
  placeholder?: string;
  /** 最大字符数 */
  maxLength?: number;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 内容操作栏组件
 * 整合评论输入框和操作按钮（点赞/收藏/分享）
 * 
 * 特点：
 * - 收起状态：[说点什么...] [❤️] [⭐] [📤]
 * - 展开状态：[多行输入框] [发送按钮]
 * - 参考小红书交互设计
 */
export default function ContentActionBar({
  onComment,
  onLike,
  onFavorite,
  onShare,
  liked = false,
  favorited = false,
  placeholder = '说点什么...',
  maxLength = 500,
  disabled = false,
}: ContentActionBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 展开输入框
  const handleExpand = () => {
    if (disabled) return;
    setIsExpanded(true);
  };

  // 收起输入框
  const handleCollapse = () => {
    setIsExpanded(false);
    setInputValue('');
  };

  // 发送评论
  const handleSubmit = async () => {
    if (!inputValue.trim() || submitting || disabled) return;

    setSubmitting(true);
    try {
      await onComment?.(inputValue.trim());
      handleCollapse();
    } catch (error) {
      console.error('评论失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // 点赞
  const handleLike = (e: any) => {
    e.stopPropagation();
    if (disabled) return;
    onLike?.();
  };

  // 收藏
  const handleFavorite = (e: any) => {
    e.stopPropagation();
    if (disabled) return;
    onFavorite?.();
  };

  // 分享
  const handleShare = (e: any) => {
    e.stopPropagation();
    if (disabled) return;
    onShare?.();
  };

  return (
    <View className="content-action-bar">
      {!isExpanded ? (
        // 收起状态：输入框占位 + 操作按钮
        <View className="action-bar-collapsed">
          <View className="input-placeholder" onClick={handleExpand}>
            <Text className="placeholder-text">{placeholder}</Text>
          </View>
          
          <View className="action-buttons">
            <View 
              className={`action-btn ${liked ? 'active' : ''}`} 
              onClick={handleLike}
            >
              <Image 
                className={`action-icon-img ${liked ? 'liked' : ''}`}
                src={liked ? ICONS.liked : ICONS.like}
                mode="aspectFit"
              />
            </View>
            
            <View 
              className={`action-btn ${favorited ? 'active' : ''}`} 
              onClick={handleFavorite}
            >
              <Image 
                className={`action-icon-img ${favorited ? 'favorited' : ''}`}
                src={favorited ? ICONS.favorited : ICONS.favorite}
                mode="aspectFit"
              />
            </View>
            
            <View className="action-btn" onClick={handleShare}>
              <Image 
                className="action-icon-img"
                src={ICONS.share}
                mode="aspectFit"
              />
            </View>
          </View>
        </View>
      ) : (
        // 展开状态：多行输入框 + 发送按钮
        <View className="action-bar-expanded">
          <Textarea
            className="comment-textarea"
            value={inputValue}
            onInput={(e) => setInputValue(e.detail.value)}
            placeholder={placeholder}
            maxlength={maxLength}
            autoHeight
            focus
            disabled={disabled}
          />
          
          <View className="expanded-actions">
            <Text className="char-count">
              {inputValue.length}/{maxLength}
            </Text>
            
            <View className="action-btns">
              <View className="cancel-btn" onClick={handleCollapse}>
                <Text className="btn-text">取消</Text>
              </View>
              
              <View 
                className={`send-btn ${inputValue.trim() && !submitting ? 'active' : 'disabled'}`}
                onClick={handleSubmit}
              >
                <Text className="btn-text">
                  {submitting ? '发送中...' : '发送'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
