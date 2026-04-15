// pages/customer/message/components/newgoods/newgoods.js
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
            openid,
            type: 'newgoods',
            limit: 30,
            page: 0
          }
        });

        if (res.result.code === 0) {
          const messageList = (res.result.data || [])
            .filter(item => item.type === 'newgoods')
            .map(item => ({
              id: item._id,
              content: item.content || item.title || '',
              btnText: '查看',
              isRead: item.isRead || false,
              createdAt: item.createdAt || item.createdat,
              productId: item.productId || item.productid
            }));

          this.setData({
            messageList,
            loading: false
          });
        } else {
          console.error('获取上新通知失败:', res.result.message);
          this.setData({
            loading: false
          });
        }
      } catch (error) {
        console.error('加载上新通知失败:', error);
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

          this.setData({
            messageList
          });
        }
      } catch (error) {
        console.error('标记消息已读失败:', error);
      }
    },

    viewDetail(e) {
      this.markAsRead(e);
      wx.navigateTo({
        url: '/pages/customer/goods/newgoods/newgoods'
      });
    },

    clearMessages() {
      this.setData({
        messageList: []
      });
    },

    deleteAllMessages() {
      this.triggerEvent('deleteAllMessages', { type: 'newgoods' });
    }
  }
});
