// pages/customer/myOrder/components/waiting/waiting.js
Component({
  data: {
    waitingStatistics: {
      waitingCount: 1,    // 待取件数
      totalCount: 2       // 总件数
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
     * 加载待取货订单数据
     * 【接口预留】后续对接后端时替换这里的假数据
     * 
     * 后端接口设计建议：
     * 接口路径：/api/order/list
     * 请求参数：{ status: 'waiting' }  // waiting-待取货（包含已到货和待到货）
     * 返回数据格式：
     * {
     *   statistics: { waitingCount: 1, totalCount: 2 },
     *   list: [
     *     {
     *       id: 'order_001',
     *       image: '商品图片URL',
     *       name: '珊迪氧气罩',
     *       price: 99.00,
     *       status: 'arrived'  // arrived-已到货, waiting-待到货
     *     }
     *   ]
     * }
     */
    loadOrderData() {
      // TODO: 替换为真实接口调用
      // 示例：调用云函数
      // wx.cloud.callFunction({
      //   name: 'getOrderList',
      //   data: { status: 'waiting' }
      // }).then(res => {
      //   this.setData({
      //     waitingStatistics: res.result.statistics,
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
            status: 'arrived'    // 已到货
          },
          {
            id: '2',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'waiting'    // 待到货
          }
        ]
      });
    }
  }
});