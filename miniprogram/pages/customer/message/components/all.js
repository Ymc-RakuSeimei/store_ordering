// pages/customer/message/components/all/all.js
Component({
  data: {
    messageList: []
  },

  lifetimes: {
    attached() {
      this.loadMessages();
    }
  },

  methods: {
    /**
     * 加载消息数据
     */
    async loadMessages() {
      try {
        // 获取用户openid
        const app = getApp();
        const openid = app.globalData.openid || await app.getOpenId();
        
        if (!openid) {
          console.error('获取openid失败');
          return;
        }
        
        // 调用云函数获取消息列表
        const res = await wx.cloud.callFunction({
          name: 'getMessageList',
          data: {
            openid: openid,
            limit: 30,
            page: 0
          }
        });
        
        if (res.result.code === 0) {
          // 格式化消息数据
          const messageList = res.result.data.map(item => ({
            id: item._id,
            content: item.content || item.title || '',
            type: item.type || 'other',
            btnText: '查看',
            isRead: item.isRead || false,
            createdAt: item.createdAt
          }));
          
          this.setData({
            messageList: messageList
          });
        } else {
          console.error('获取消息列表失败:', res.result.message);
        }
      } catch (error) {
        console.error('加载消息失败:', error);
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
        
        // 调用云函数标记消息为已读
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
          // 更新本地消息状态
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

    /**
     * 查看详情
     */
    viewDetail(e) {
      const { id } = e.currentTarget.dataset;
      // 根据消息类型跳转到不同页面
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

    /**
     * 清空所有消息（供父组件调用）
     */
    clearMessages() {
      this.setData({
        messageList: []
      });
    }
  }
});