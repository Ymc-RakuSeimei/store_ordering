// pages/customer/message/components/all/all.js
Component({
  data: {
    messageList: [],
    loading: true
  },

  lifetimes: {
    attached() {
      this.loadMessages();
    }
  },

  methods: {
    async loadMessages() {
      try {
        const app = getApp();
        const openid = app.globalData.openid || await app.getOpenId();

        if (!openid) {
          console.error('获取openid失败');
          return;
        }

        const res = await wx.cloud.callFunction({
          name: 'getMessageList',
          data: {
            openid: openid,
            limit: 30,
            page: 0
          }
        });

        if (res.result.code === 0) {
          const messageList = res.result.data.map(item => ({
            id: item._id,
            content: item.content || item.title || '',
            type: item.type || 'other',
            btnText: '查看',
            isRead: item.isRead || false,
            createdAt: item.createdAt
          }));

          this.setData({
            messageList: messageList,
            loading: false
          });
        } else {
          console.error('获取消息列表失败:', res.result.message);
          this.setData({
            loading: false
          });
        }
      } catch (error) {
        console.error('加载消息失败:', error);
        this.setData({
          loading: false
        });
      }
    },

    async markAsRead(e) {
      try {
        const messageId = e.currentTarget.dataset.id;
        const app = getApp();
        const openid = app.globalData.openid || await app.getOpenId();

        if (!openid) {
          return;
        }

        const res = await wx.cloud.callFunction({
          name: 'getMessageList',
          data: {
            openid: openid,
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

          this.setData({
            messageList: messageList
          });
        }
      } catch (error) {
        console.error('标记消息已读失败:', error);
      }
    },

    viewDetail(e) {
      const { id } = e.currentTarget.dataset;
      const message = this.data.messageList.find(item => item.id === id);
      if (message.type === 'pickup') {
        wx.navigateTo({
          url: `/pages/customer/myOrder/myOrder?tab=waiting`
        });
      } else if (message.type === 'newgoods') {
        wx.navigateTo({
          url: `/pages/customer/goods/newgoods/newgoods`
        });
      }
    },

    clearMessages() {
      this.setData({
        messageList: []
      });
    },

    deleteAllMessages() {
      this.triggerEvent('deleteAllMessages', { type: 'all' });
    }
  }
});
