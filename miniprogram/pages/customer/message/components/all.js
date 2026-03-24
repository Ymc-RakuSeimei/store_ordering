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
     * 【接口预留】后续对接后端时替换
     */
    loadMessages() {
      // TODO: 替换为真实接口调用
      this.setData({
        messageList: [
          {
            id: '1',
            content: '你有n件商品到货，请及时取货',
            type: 'pickup',
            btnText: '查看'
          },
          {
            id: '2',
            content: '店铺上新：海绵宝宝同款捕鱼网',
            type: 'newgoods',
            btnText: '查看'
          }
        ]
      });
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