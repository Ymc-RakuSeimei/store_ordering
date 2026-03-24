// pages/index/index.js
const app = getApp();

Page({
  data: {
    loading: true,
    showDebug: false,
    redirectTimer: null   // 定时器 ID
  },

  onLoad() {
    // 仅在开发版或体验版显示调试入口
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    this.setData({ showDebug: envVersion === 'develop' || envVersion === 'trial' });
    this.initRedirect();
  },

  async initRedirect() {
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;//获取当前环境状态
    if (envVersion === 'release') {
          // 正式版直接跳转
      this.performRedirect(role);
      return;
  }   
// 开发时才延迟
    try {
      const role = await app.getUserRole();
      console.log('首页获取角色:', role);

      // 设置定时器，1秒后自动跳转
      const timer = setTimeout(() => {
        this.performRedirect(role);
      }, 1000);
      this.setData({ redirectTimer: timer });
    } catch (err) {
      console.error('获取角色失败，默认进入买家端', err);
      // 出错时延迟跳转
      const timer = setTimeout(() => {
        this.performRedirect('customer');
      }, 1000);
      this.setData({ redirectTimer: timer });
    }
  },

  performRedirect(role) {
    // 清除已存在的定时器，避免重复跳转
    if (this.data.redirectTimer) {
      clearTimeout(this.data.redirectTimer);
      this.setData({ redirectTimer: null });
    }

    if (role === 'merchant') {
      wx.reLaunch({ url: '/pages/merchant/index/index' });
    } else {
      // 买家端是 tabBar，所以用wx.switchTab
      wx.switchTab({ url: '/pages/customer/index/index' });
    }
  },

  // 长按进入调试页面
  openDebugPage() {
    // 取消自动跳转定时器
    if (this.data.redirectTimer) {
      clearTimeout(this.data.redirectTimer);
      this.setData({ redirectTimer: null });
    }
    wx.navigateTo({
      url: '/pages/debug/index',
      success: () => console.log('进入调试页面'),
      fail: err => console.error('打开调试页失败', err)
    });
  },

  onUnload() {
    // 页面卸载时清除定时器，避免内存泄漏
    if (this.data.redirectTimer) {
      clearTimeout(this.data.redirectTimer);
    }
  }
});