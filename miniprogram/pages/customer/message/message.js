// pages/customer/message/message.js
Page({
  data: {
    currentTab: 'all',
    messageList: [],
    filteredMessageList: [],
    hasFilteredMessages: false,
    loading: true
  },

  onLoad(options) {
    const nextTab = options.tab || 'all';
    this.setData({
      currentTab: nextTab
    });
    this.loadMessages();
  },

  async loadMessages() {
    try {
      this.setData({ loading: true });

      const app = getApp();
      const openid = app.globalData.openid || await app.getOpenId();

      if (!openid) {
        console.error('获取openid失败');
        this.setData({ loading: false });
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'getMessageList',
        data: {
          openid,
          limit: 30,
          page: 0
        }
      });

      if (res.result.code === 0) {
        const messageList = (res.result.data || []).map(item => ({
          id: item._id,
          content: item.content || item.title || '',
          type: item.type || 'other',
          btnText: '查看',
          isRead: item.isRead || false,
          createdAt: item.createdAt,
          productId: item.productId || item.productid
        }));

        this.updateVisibleMessages({
          messageList,
          loading: false
        });
      } else {
        console.error('获取消息列表失败:', res.result.message);
        this.setData({ loading: false });
      }
    } catch (error) {
      console.error('加载消息失败:', error);
      this.setData({ loading: false });
    }
  },

  getFilteredMessageList(messageList = this.data.messageList, currentTab = this.data.currentTab) {
    if (currentTab === 'all') {
      return messageList;
    }
    return messageList.filter(item => item.type === currentTab);
  },

  updateVisibleMessages(extraData = {}) {
    const nextMessageList = extraData.messageList || this.data.messageList;
    const nextTab = extraData.currentTab || this.data.currentTab;
    const filteredMessageList = this.getFilteredMessageList(nextMessageList, nextTab);

    this.setData({
      ...extraData,
      filteredMessageList,
      hasFilteredMessages: filteredMessageList.length > 0
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.redirectTo({ url: '/pages/customer/index/index' });
      }
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.updateVisibleMessages({
      currentTab: tab
    });
  },

  async markAsRead(e) {
    try {
      const messageId = e.currentTarget.dataset.id;
      const app = getApp();
      const openid = app.globalData.openid || await app.getOpenId();

      if (!openid || !messageId) {
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'getMessageList',
        data: {
          openid,
          markRead: messageId,
          limit: 1,
          page: 0
        }
      });

      if (res.result.code === 0) {
        const messageList = this.data.messageList.map(item => {
          if (item.id === messageId) {
            return { ...item, isRead: true };
          }
          return item;
        });

        this.updateVisibleMessages({ messageList });
      }
    } catch (error) {
      console.error('标记消息已读失败:', error);
    }
  },

  async viewDetail(e) {
    const { id } = e.currentTarget.dataset;
    const message = this.data.messageList.find(item => item.id === id);

    if (!message) {
      return;
    }

    await this.markAsRead(e);

    if (message.type === 'pickup') {
      wx.navigateTo({
        url: '/pages/customer/myOrder/myOrder?tab=waiting'
      });
      return;
    }

    if (message.type === 'newgoods') {
      wx.navigateTo({
        url: '/pages/customer/goods/newgoods/newgoods'
      });
    }
  },

  deleteAllMessages() {
    const type = this.data.currentTab;
    const typeLabel = type === 'all' ? '' : type === 'pickup' ? '取货提醒' : '上新通知';

    wx.showModal({
      title: '提示',
      content: `确定要删除所有${typeLabel}消息吗？`,
      success: async (res) => {
        if (!res.confirm) {
          return;
        }

        try {
          const app = getApp();
          const openid = app.globalData.openid || await app.getOpenId();

          if (!openid) {
            wx.showToast({ title: '获取用户信息失败', icon: 'none' });
            return;
          }

          const deleteRes = await wx.cloud.callFunction({
            name: 'deleteMessage',
            data: {
              type,
              openid
            }
          });

          if (deleteRes.result.code === 0) {
            const messageList = type === 'all'
              ? []
              : this.data.messageList.filter(item => item.type !== type);

            this.updateVisibleMessages({ messageList });
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
    });
  },

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
