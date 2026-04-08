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
  deleteAllMessages(e) {
    const type = e.detail ? e.detail.type : this.data.currentTab;

    wx.showModal({
      title: '提示',
      content: `确定要删除所有${type === 'all' ? '' : type === 'pickup' ? '取货提醒' : '上新通知'}消息吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            // 获取用户openid
            const app = getApp();
            const openid = app.globalData.openid || await app.getOpenId();
            
            if (!openid) {
              wx.showToast({ title: '获取用户信息失败', icon: 'none' });
              return;
            }
            
            // 调用云函数删除消息
            const deleteRes = await wx.cloud.callFunction({
              name: 'deleteMessage',
              data: {
                type: type,
                openid: openid
              }
            });

            if (deleteRes.result.code === 0) {
              // 触发组件刷新消息列表
              const component = this.selectComponent(`.${type}-component`);
              if (component && component.clearMessages) {
                component.clearMessages();
                // 重新加载消息
                if (component.loadMessages) {
                  component.loadMessages();
                }
              }
              wx.showToast({
                title: '已删除',
                icon: 'success'
              });
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          } catch (error) {
            console.error('删除消息失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
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