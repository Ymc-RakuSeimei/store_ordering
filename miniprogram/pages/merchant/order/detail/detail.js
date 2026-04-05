const STATUS_PENDING_PICKUP = '\u5f85\u53d6\u8d27';
const STATUS_PICKED = '\u5df2\u53d6\u8d27';
const STATUS_COMPLETED = '\u5df2\u5b8c\u6210';

function decorateOrderDetail(order = null) {
  if (!order || !Array.isArray(order.orders)) {
    return order;
  }

  return {
    ...order,
    orders: order.orders.map((orderItem) => ({
      ...orderItem,
      goods: Array.isArray(orderItem.goods)
        ? orderItem.goods.map((goodsItem) => ({
          ...goodsItem,
          statusClass: getStatusClass(goodsItem.pickupStatus)
        }))
        : []
    }))
  };
}

function getStatusClass(status = '') {
  if (status === STATUS_PENDING_PICKUP) {
    return 'goods-status--pickup';
  }

  if (status === STATUS_PICKED || status === STATUS_COMPLETED) {
    return 'goods-status--picked';
  }

  return 'goods-status--default';
}

Page({
  data: {
    customerKey: '',
    order: null,
    loading: true
  },

  onLoad(options) {
    const customerKey = decodeURIComponent(options.customerKey || '');
    this.setData({ customerKey });
    wx.setNavigationBarTitle({ title: '顾客订单详情' });

    if (!customerKey) {
      wx.showToast({ title: '缺少顾客标识', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    this.loadOrderDetail(customerKey);
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.redirectTo({ url: '/pages/merchant/order/order' });
      }
    });
  },

  loadOrderDetail(customerKey) {
    this.setData({ loading: true });

    this.fetchOrderDetailFromServer(customerKey)
      .then((order) => {
        this.setData({
          order: decorateOrderDetail(order),
          loading: false
        });
      })
      .catch((err) => {
        console.error('fetchOrderDetailFromServer error', err);
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  fetchOrderDetailFromServer(customerKey) {
    return wx.cloud.callFunction({
      name: 'getMerchantOrderGoods',
      data: {
        type: 'customerDetail',
        customerKey
      }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取顾客订单详情失败');
      }
      return result.data || null;
    });
  }
});
