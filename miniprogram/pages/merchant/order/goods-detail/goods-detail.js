const STATUS_WAITING = '未到货';
const STATUS_PENDING_PICKUP = '待取货';
const STATUS_PICKED = '已取货';
const STATUS_COMPLETED = '已完成';

function getStatusClass(status = '') {
  if (status === STATUS_WAITING) {
    return 'buyer-status--waiting';
  }

  if (status === STATUS_PENDING_PICKUP) {
    return 'buyer-status--pickup';
  }

  if (status === STATUS_PICKED || status === STATUS_COMPLETED) {
    return 'buyer-status--picked';
  }

  return 'buyer-status--default';
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  return amount.toFixed(2);
}

function decorateGoodsDetail(detail = null) {
  if (!detail) {
    return null;
  }

  return {
    ...detail,
    totalPriceText: formatMoney(detail.totalPrice),
    totalCostText: formatMoney(detail.totalCost),
    totalProfitText: formatMoney(detail.totalProfit),
    customers: Array.isArray(detail.customers)
      ? detail.customers.map((item) => ({
        ...item,
        totalAmountText: formatMoney(item.totalAmount),
        statusClass: getStatusClass(item.status)
      }))
      : []
  };
}

Page({
  data: {
    goodsId: '',
    docId: '',
    detail: null,
    loading: true
  },

  onLoad(options) {
    const goodsId = decodeURIComponent(options.goodsId || '');
    const docId = decodeURIComponent(options.docId || '');

    this.setData({ goodsId, docId });
    wx.setNavigationBarTitle({ title: '商品详情' });

    if (!goodsId && !docId) {
      wx.showToast({ title: '缺少商品标识', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    this.loadGoodsDetail();
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.redirectTo({ url: '/pages/merchant/order/order' });
      }
    });
  },

  // 详情页直接复用订单处理云函数，避免再开一条后端接口。
  loadGoodsDetail() {
    const { goodsId, docId } = this.data;

    this.setData({ loading: true });

    this.fetchGoodsDetailFromServer({ goodsId, docId })
      .then((detail) => {
        this.setData({
          detail: decorateGoodsDetail(detail),
          loading: false
        });
      })
      .catch((err) => {
        console.error('fetchGoodsDetailFromServer error', err);
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  fetchGoodsDetailFromServer({ goodsId, docId }) {
    return wx.cloud.callFunction({
      name: 'getMerchantOrderGoods',
      data: {
        type: 'goodsDetail',
        goodsId,
        docId
      }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取商品详情失败');
      }
      return result.data || null;
    });
  }
});
