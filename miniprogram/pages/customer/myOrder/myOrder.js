// pages/customer/myOrder/myOrder.js
Page({
  data: {
    currentTab: 'all'
  },

  onLoad(options) {
    if (options.tab) {
      this.setData({
        currentTab: options.tab
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },

  // 底部导航跳转
  goToHome() {
    wx.switchTab({
      url: '/pages/customer/index/index'
    });
  },

  goToGoods() {
    wx.switchTab({
      url: '/pages/customer/goods/goods'
    });
  },

  goToMy() {
    wx.switchTab({
      url: '/pages/customer/my/my'
    });
  }
});