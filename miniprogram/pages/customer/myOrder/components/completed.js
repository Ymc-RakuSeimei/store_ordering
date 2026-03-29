// pages/customer/myOrder/components/completed/completed.js
Component({
  data: {
    completedStatistics: {
      total: 2    // 总完成件数
    },
    orderList: []
  },

  lifetimes: {
    attached() {
      this.loadOrderData();
    }
  },

  methods: {
    /**
     * 加载已完成订单数据
     * 【接口预留】后续对接后端时替换这里的假数据
     * 
     * 后端接口设计建议：
     * 接口路径：/api/order/list
     * 请求参数：{ status: 'completed' }  // completed-已完成
     * 返回数据格式：
     * {
     *   statistics: { total: 2 },
     *   list: [
     *     {
     *       id: 'order_001',
     *       image: '商品图片URL',
     *       name: '珊迪氧气罩',
     *       price: 99.00,
     *       status: 'completed'
     *     }
     *   ]
     * }
     */
    loadOrderData() {
      // TODO: 替换为真实接口调用
      // 示例：调用云函数
      // wx.cloud.callFunction({
      //   name: 'getOrderList',
      //   data: { status: 'completed' }
      // }).then(res => {
      //   this.setData({
      //     completedStatistics: res.result.statistics,
      //     orderList: res.result.list
      //   });
      // });
      
      // 临时假数据（方便你调试样式）
      this.setData({
        orderList: [
          {
            id: '1',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'completed'
          },
          {
            id: '2',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'completed'
          }
        ]
      });
    },

    /**
     * 去评价
     * @param {Object} e 事件对象
     */
    handleEvaluate(e) {
      const { id } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/customer/evaluate/evaluate?orderId=${id}`
      });
    }
  }
});