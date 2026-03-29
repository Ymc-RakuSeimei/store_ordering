// pages/customer/myOrder/components/all/all.js
Component({
  data: {
    orderStatistics: {
      total: 4,
      completed: 2
    },
    orderList: []
  },

  lifetimes: {
    attached() {
      this.loadOrderData();
    }
  },

  methods: {
    loadOrderData() {
      // TODO: 替换为真实接口调用
      this.setData({
        orderList: [
          {
            id: '1',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'arrived'
          },
          {
            id: '2',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'waiting'
          },
          {
            id: '3',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'completed'
          },
          {
            id: '4',
            image: '/images/goods_sample.png',
            name: '珊迪氧气罩',
            price: 99.00,
            status: 'completed'
          }
        ]
      });
    },

    handleEvaluate(e) {
      const { id } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/customer/evaluate/evaluate?orderId=${id}`
      });
    }
  }
});