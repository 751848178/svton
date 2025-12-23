import Taro from '@tarojs/taro';

interface SystemInfo {
  statusBarHeight: number;
  safeAreaInsets: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  menuButton?: {
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  navBarHeight: number;
  windowWidth: number;
  windowHeight: number;
}

class SystemInfoManager {
  private info: SystemInfo | null = null;

  async init() {
    try {
      const systemInfo = await Taro.getSystemInfo();
      const statusBarHeight = systemInfo.statusBarHeight || 44;
      const windowWidth = systemInfo.windowWidth || 375;
      const windowHeight = systemInfo.windowHeight || 667;

      // 获取安全区域
      const safeArea = systemInfo.safeArea || {
        top: statusBarHeight,
        right: windowWidth,
        bottom: windowHeight,
        left: 0,
      };

      const safeAreaInsets = {
        top: safeArea.top,
        right: windowWidth - safeArea.right,
        bottom: windowHeight - safeArea.bottom,
        left: safeArea.left,
      };

      // 获取胶囊按钮信息（仅小程序）
      let menuButton;
      let navBarHeight = statusBarHeight + 44; // 默认导航栏高度

      try {
        if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
          menuButton = Taro.getMenuButtonBoundingClientRect();
          // 导航栏高度 = 胶囊底部位置 + (胶囊顶部到状态栏的距离)
          navBarHeight = menuButton.bottom + (menuButton.top - statusBarHeight);
        }
      } catch (e) {
        console.warn('获取胶囊按钮信息失败', e);
      }

      this.info = {
        statusBarHeight,
        safeAreaInsets,
        menuButton,
        navBarHeight,
        windowWidth,
        windowHeight,
      };

      // 设置 CSS 变量
      this.setCSSVariables();

      console.log('系统信息初始化成功:', this.info);
      return this.info;
    } catch (error) {
      console.error('获取系统信息失败', error);
      // 设置默认值
      this.info = {
        statusBarHeight: 44,
        safeAreaInsets: { top: 44, right: 0, bottom: 0, left: 0 },
        navBarHeight: 88,
        windowWidth: 375,
        windowHeight: 667,
      };
      this.setCSSVariables();
      return this.info;
    }
  }

  private setCSSVariables() {
    if (!this.info) return;

    try {
      // 在小程序环境中，document 可能不存在
      if (typeof document !== 'undefined' && document.documentElement) {
        const root = document.documentElement;
        root.style.setProperty('--status-bar-height', `${this.info.statusBarHeight}px`);
        root.style.setProperty('--safe-area-top', `${this.info.safeAreaInsets.top}px`);
        root.style.setProperty('--safe-area-right', `${this.info.safeAreaInsets.right}px`);
        root.style.setProperty('--safe-area-bottom', `${this.info.safeAreaInsets.bottom}px`);
        root.style.setProperty('--safe-area-left', `${this.info.safeAreaInsets.left}px`);
        root.style.setProperty('--nav-bar-height', `${this.info.navBarHeight}px`);

        if (this.info.menuButton) {
          root.style.setProperty('--menu-button-width', `${this.info.menuButton.width}px`);
          root.style.setProperty('--menu-button-height', `${this.info.menuButton.height}px`);
          root.style.setProperty('--menu-button-top', `${this.info.menuButton.top}px`);
          root.style.setProperty('--menu-button-right', `${this.info.menuButton.right}px`);
          root.style.setProperty('--menu-button-bottom', `${this.info.menuButton.bottom}px`);
          root.style.setProperty('--menu-button-left', `${this.info.menuButton.left}px`);
        }

        console.log('CSS 变量设置成功');
      }
    } catch (e) {
      console.warn('设置 CSS 变量失败', e);
    }
  }

  getInfo(): SystemInfo | null {
    return this.info;
  }

  getStatusBarHeight(): number {
    return this.info?.statusBarHeight || 44;
  }

  getNavBarHeight(): number {
    return this.info?.navBarHeight || 88;
  }

  getSafeAreaInsets() {
    return this.info?.safeAreaInsets || { top: 44, right: 0, bottom: 0, left: 0 };
  }
}

export const systemInfoManager = new SystemInfoManager();
