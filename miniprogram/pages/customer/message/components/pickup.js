// pages/customer/message/components/pickup/pickup.js
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
    /**
     * 加载取货提醒消息
     */
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
            type: 'pickup',
            limit: 30,
            page: 0
          }
        });

        if (res.result.code === 0) {
          const messageList = (res.result.data || [])
            .filter(item => item.type === 'pickup')
            .map(item => ({
              id: item._id,
              content: item.content || item.title || '',
              btnText: '查看',
              isRead: item.isRead || false,
              createdAt: item.createdAt
            }));

          this.setData({
            messageList,
            loading: false
          });
        } else {
          console.error('获取取货提醒失败:', res.result.message);
          this.setData({
            loading: false
          });
        }
      } catch (error) {
        console.error('加载取货提醒失败:', error);
        this.setData({
          loading: false
        });
      }
    },

    /**
     * 标记消息为已读
     */
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

    /**
     * 查看详情 - 跳转到待取货页面
     */
    viewDetail() {
      wx.navigateTo({
        url: '/pages/customer/myOrder/myOrder?tab=waiting'
      });
    },

    /**
     * 清空所有消息（供父组件调用）
     */
    clearMessages() {
      this.setData({
        messageList: []
      });
    },

    /**
     * 一键删除所有消息
     */
    deleteAllMessages() {
      this.triggerEvent('deleteAllMessages', { type: 'pickup' });
    }
  }
});
