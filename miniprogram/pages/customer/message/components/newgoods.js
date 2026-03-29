// pages/customer/message/components/newgoods/newgoods.js
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
     * 加载上新通知消息
     * 【接口预留】后续对接后端时替换
     */
    loadMessages() {
      // TODO: 替换为真实接口调用
      this.setData({
        messageList: [
          {
            id: '1',
            content: '店铺上新：海绵宝宝同款捕鱼网',
            btnText: '查看'
          }
        ]
      });
    },

    /**
     * 查看详情 - 跳转到今日上新页面
     */
    viewDetail(e) {
      const { id } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/customer/goods/newgoods/newgoods`
      });
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