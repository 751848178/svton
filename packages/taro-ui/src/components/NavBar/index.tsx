import React, { useEffect, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { systemInfoManager } from '../../utils/systemInfo';
import StatusBar from '../StatusBar';
import './index.scss';

// 返回箭头 SVG 图标（内联 base64）
const BACK_ICON_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTUgMThMOSAxMkwxNSA2IiBzdHJva2U9IiMzMzMzMzMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';

interface CustomNavBarProps {
  title?: string;
  showBack?: boolean;
  showClose?: boolean;
  backgroundColor?: string;
  textColor?: string;
  onBack?: () => void;
  onClose?: () => void;
  rightContent?: React.ReactNode;
  fixed?: boolean;
  /**
   * 滚动透明度 (0-1)
   * 0: 完全透明, 1: 完全不透明
   * 用于实现滚动时导航栏逐渐显示的效果
   */
  scrollOpacity?: number;
  /**
   * 是否显示状态栏
   * 默认 true，只在小程序环境中显示
   * H5 环境会自动忽略
   */
  showStatusBar?: boolean;
}

/**
 * 自定义导航栏组件
 * 自动适配刘海屏和胶囊按钮
 */
export default function CustomNavBar({
  title = '',
  showBack = false,
  showClose = false,
  backgroundColor = '#ffffff',
  textColor = '#333333',
  onBack,
  onClose,
  rightContent,
  fixed = false,
  scrollOpacity = 1,
  showStatusBar = true,
}: CustomNavBarProps) {
  const [navBarContentHeight, setNavBarContentHeight] = useState(44);
  const [statusBarHeight, setStatusBarHeight] = useState(44);
  const [menuButtonLeft, setMenuButtonLeft] = useState(0);
  const [isMiniProgram, setIsMiniProgram] = useState(false);

  // 根据滚动透明度计算实际背景色
  const getBackgroundColor = () => {
    if (scrollOpacity >= 1) {
      return backgroundColor;
    }
    
    // 将hex颜色转换为rgba，应用透明度
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${scrollOpacity})`;
  };

  useEffect(() => {
    // 判断是否为小程序环境
    const env = Taro.getEnv();
    const isMini = env === Taro.ENV_TYPE.WEAPP || 
                   env === Taro.ENV_TYPE.ALIPAY || 
                   env === Taro.ENV_TYPE.SWAN ||
                   env === Taro.ENV_TYPE.TT ||
                   env === Taro.ENV_TYPE.QQ ||
                   env === Taro.ENV_TYPE.JD;
    setIsMiniProgram(isMini);

    const info = systemInfoManager.getInfo();
    if (info) {
      // 导航栏内容高度 = 完整导航栏高度 - 状态栏高度
      setNavBarContentHeight(info.navBarHeight - info.statusBarHeight);
      setStatusBarHeight(info.statusBarHeight);

      if (info.menuButton) {
        setMenuButtonLeft(info.menuButton.left);
      }
    }
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      // 检查是否可以返回
      const pages = Taro.getCurrentPages();
      if (pages.length > 1) {
        Taro.navigateBack().catch((err) => {
          console.warn('返回失败:', err);
          // 如果返回失败，尝试跳转到首页
          Taro.switchTab({ url: '/pages/index/index' }).catch(() => {
            console.error('跳转首页失败');
          });
        });
      } else {
        // 已经是第一页，跳转到首页
        Taro.switchTab({ url: '/pages/index/index' }).catch(() => {
          console.error('跳转首页失败');
        });
      }
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      // 检查是否可以返回
      const pages = Taro.getCurrentPages();
      if (pages.length > 1) {
        Taro.navigateBack().catch((err) => {
          console.warn('关闭失败:', err);
          Taro.switchTab({ url: '/pages/index/index' }).catch(() => {
            console.error('跳转首页失败');
          });
        });
      } else {
        // 已经是第一页，跳转到首页
        Taro.switchTab({ url: '/pages/index/index' }).catch(() => {
          console.error('跳转首页失败');
        });
      }
    }
  };

  // 计算右侧内容的安全距离（避开胶囊按钮）
  const getRightSafeDistance = () => {
    if (menuButtonLeft > 0) {
      const info = systemInfoManager.getInfo();
      if (info) {
        return info.windowWidth - menuButtonLeft + 8;
      }
    }
    return 100; // 默认值
  };

  const navBarClass = `custom-nav-bar ${fixed ? 'fixed' : ''}`;
  const actualBgColor = getBackgroundColor();
  
  // 是否应该渲染 StatusBar（只在小程序环境且用户允许时显示）
  const shouldShowStatusBar = isMiniProgram && showStatusBar;
  
  // 计算导航栏总高度（状态栏 + 内容区）
  // 只有在小程序环境且显示状态栏时才计入状态栏高度
  const totalHeight = (shouldShowStatusBar ? statusBarHeight : 0) + navBarContentHeight;

  const navBarContent = (
    <View className={navBarClass} style={{ backgroundColor: actualBgColor }}>
      {shouldShowStatusBar && <StatusBar backgroundColor={actualBgColor} />}

      <View
        className="nav-bar-content"
        style={{
          height: `${navBarContentHeight}px`,
          backgroundColor: actualBgColor,
        }}
      >
        {/* 左侧按钮区域 */}
        {(showBack || showClose) && (
          <View className="nav-left">
            {showBack && (
              <View className="nav-btn" onClick={handleBack}>
                <Image 
                  className="nav-icon-img back-icon-img"
                  src={BACK_ICON_SVG}
                  mode="aspectFit"
                />
              </View>
            )}
            {showClose && (
              <View className="nav-btn" onClick={handleClose}>
                <Text className="nav-icon close-icon" style={{ color: textColor }}>
                  ✕
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 标题 */}
        {title && (
          <View className="nav-title">
            <Text className="title-text" style={{ color: textColor }}>
              {title}
            </Text>
          </View>
        )}

        {/* 右侧内容 */}
        {rightContent && (
          <View className="nav-right" style={{ right: `${getRightSafeDistance()}px` }}>
            {rightContent}
          </View>
        )}
      </View>
    </View>
  );

  // 如果是 fixed 定位，需要添加占位元素
  if (fixed) {
    return (
      <>
        {/* 占位元素，保持文档流 */}
        <View 
          className="nav-bar-placeholder" 
          style={{ height: `${totalHeight}px` }}
        />
        {/* 实际的导航栏（fixed 定位）*/}
        {navBarContent}
      </>
    );
  }

  return navBarContent;
}
