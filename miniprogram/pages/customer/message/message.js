// pages/customer/message/message.js
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
      delta: 1,
      fail: function () {
        wx.redirectTo({ url: '/pages/customer/index/index' });
      }
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },

  // 一键删除所有消息
  deleteAllMessages() {
    wx.showModal({
      title: '提示',
      content: '确定要删除所有消息吗？',
      success: (res) => {
        if (res.confirm) {
          // 触发组件刷新消息列表
          const component = this.selectComponent(`.${this.data.currentTab}-component`);
          if (component && component.clearMessages) {
            component.clearMessages();
          }
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
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