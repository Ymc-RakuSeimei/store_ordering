// pages/customer/message/components/pickup/pickup.js
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
     * 加载取货提醒消息
     * 【接口预留】后续对接后端时替换
     */
    loadMessages() {
      // TODO: 替换为真实接口调用
      this.setData({
        messageList: [
          {
            id: '1',
            content: '你有n件商品到货，请及时取货',
            btnText: '查看'
          }
        ]
      });
    },

    /**
     * 查看详情 - 跳转到待取货页面
     */
    viewDetail(e) {
      const { id } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/customer/myOrder/myOrder?tab=waiting`
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