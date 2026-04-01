Page({
  data: {
    orderId: '',
    order: null,
    loading: true
  },

  onLoad(options) {
    const orderId = options.orderId;
    this.setData({ orderId });
    wx.setNavigationBarTitle({ title: '订单详情' });
    this.loadOrderDetail(orderId);
  },

  // 返回上一页
  onBack() {
    wx.navigateBack();
  },

  // 加载订单详情（后端接口）
  loadOrderDetail(orderId) {
    this.fetchOrderDetailFromServer(orderId)
      .then(order => {
        this.setData({ order, loading: false });
      })
      .catch(err => {
        console.error('fetchOrderDetailFromServer error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  // 取货操作(单个商品)
  pickSingleItem(e) {
    const row = e.currentTarget.dataset.row;
    this.updateOrderItemStatus({
      orderId: this.data.orderId,
      itemId: row.id,
      status: 'picked'
    }).then(() => {
      wx.showToast({ title: '取货成功', icon: 'success' });
      this.loadOrderDetail(this.data.orderId);
    }).catch(err => {
      console.error('updateOrderItemStatus error', err);
      wx.showToast({ title: '取货失败', icon: 'none' });
    });
  },

  // 一键取货
  pickAll() {
    this.updateOrderItemStatus({
      orderId: this.data.orderId,
      status: 'picked',
      all: true
    }).then(() => {
      wx.showToast({ title: '已全部取货', icon: 'success' });
      this.loadOrderDetail(this.data.orderId);
    }).catch(err => {
      console.error('pickAll error', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  // ----------------- 后端接口占位 -----------------
  fetchOrderDetailFromServer(orderId) {
    // TODO: 后端实现，返回 Promise(resolve(order))
    // 数据库字段映射：
    // - customerInfo.name -> customerName
    // - customerInfo.phone -> phone
    // - goods 数组拆分：
    //   arrivedtime 有值 -> pendingPickup
    //   arrivedtime 无值 -> pendingArrival
    return Promise.resolve({
      _id: orderId,
      orderNo: 'ORD202603270001',
      customerName: 'YMC',
      phone: '123456789',
      status: '可取货',
      totalPrice: 166.5,
      pickupCode: '633116',
      remark: '测试订单，用于取货核销页面测试',
      pendingPickup: [
        { id: '1', name: '珊迪氧气罩', qty: 1, spec: '0.5kg' },
        { id: '2', name: '派大星的扁担', qty: 3, spec: '0.5kg' }
      ],
      pendingArrival: [
        { id: '3', name: '蟹黄堡秘方', qty: 1, spec: '0.5kg' }
      ]
    });
  },
  updateOrderItemStatus(payload) {
    // TODO: 后端实现，返回 Promise
    return Promise.resolve();
  }
});