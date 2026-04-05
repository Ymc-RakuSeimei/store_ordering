Page({
  data: {
    goodsId: '',
    goods: null,
    orders: [],
    loading: true
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '接龙详情' });

    const goodsId = options.id;
    if (goodsId) {
      this.setData({ goodsId });
      this.loadDetail();
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow() {
    // 每次显示时都刷新数据，确保能看到最新订单
    if (this.data.goodsId) {
      this.loadDetail();
    }
  },

  onPullDownRefresh() {
    this.loadDetail().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.redirectTo({ url: '/pages/merchant/preorder/preorder' });
      }
    });
  },

  getStatusClass(status) {
    const statusMap = {
      '未到货': 'waiting',
      '待取货': 'pending',
      '已到货': 'arrived',
      '已取货': 'picked',
      '已完成': 'completed'
    };
    return statusMap[status] || 'waiting';
  },

  async loadDetail() {
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'fetchPreorderOrders',
        data: {
          goodsId: this.data.goodsId
        }
      });

      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取详情失败');
      }

      const data = result.data || {};
      const orders = (data.orders || []).map(order => ({
        ...order,
        statusClass: this.getStatusClass(order.pickupStatus)
      }));
      this.setData({
        goods: data.goods || null,
        orders: orders,
        loading: false
      });
    } catch (err) {
      console.error('loadDetail error', err);
      wx.showToast({
        title: err.message || '获取详情失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  }
});
