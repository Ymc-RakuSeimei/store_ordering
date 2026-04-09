// pages/customer/index/index.js
Page({
  data: {
    userInfo: {
      nickName: '派大星',
      avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
    },
    unreadMessageCount: 0
  },

  onLoad() {
    this.getUserInfo();
    this.getUnreadMessageCount();
  },

  onShow() {
    this.getUserInfo();
    this.getUnreadMessageCount();
  },

  async getUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      });

      if (res.result.success && res.result.user) {
        this.setData({
          userInfo: {
            nickName: res.result.user.nickName || '派大星',
            avatarUrl: res.result.user.avatarUrl || 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
          }
        });
        return;
      }
    } catch (err) {
      console.error('获取用户信息失败', err);
    }

    this.setData({
      userInfo: {
        nickName: '派大星',
        avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
      }
    });
  },

  async getUnreadMessageCount() {
    try {
      const app = getApp();
      const openid = app.globalData.openid || await app.getOpenId();
      if (!openid) {
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'getMessageList',
        data: {
          openid,
          limit: 100,
          page: 0
        }
      });

      if (res.result.code === 0) {
        this.setData({
          unreadMessageCount: res.result.data.filter((item) => !item.isRead).length
        });
      }
    } catch (err) {
      console.error('获取未读消息数量失败', err);
    }
  },

  goToNewGoods() {
    wx.navigateTo({ url: '/pages/customer/goods/newgoods/newgoods' });
  },

  goToShopList() {
    wx.switchTab({ url: '/pages/customer/goods/goods' });
  },

  goToMyOrder() {
    wx.navigateTo({ url: '/pages/customer/myOrder/myOrder' });
  },

  goToFeedback() {
    wx.navigateTo({
      url: '/pages/customer/myOrder/myOrder?tab=waiting'
    });
  },

  goToMessage() {
    wx.navigateTo({ url: '/pages/customer/message/message' });
  },

  openAiAssistant() {
    wx.navigateTo({
      url: '/pages/ai-assistant/index?role=customer'
    });
  }
});
