Page({
  data: {
    activeTab: 'pickup',
    tabs: [
      { id: 'pickup', label: '待取货' },
      { id: 'arrival', label: '待到货' },
      { id: 'customer', label: '顾客订单' },
      { id: 'feedback', label: '售后反馈' }
    ],
    orderData: {
      pickup: [],
      arrival: [],
      customer: [],
      feedback: []
    },
    loading: true
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '订单处理' });
    this.loadAllOrders();
  },

  onBack() {
    wx.navigateBack();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  loadAllOrders() {
    this.setData({ loading: true });

    Promise.all([
      this.fetchGoodsListFromServer('pickup'),    // 待取货 - goods表
      this.fetchGoodsListFromServer('arrival'),   // 待到货 - goods表
      this.fetchCustomerOrdersFromServer(),          // 顾客订单 - orders表
      this.fetchFeedbackListFromServer()           // 售后反馈
    ])
      .then(([pickup, arrival, customer, feedback]) => {
        this.setData({
          orderData: { pickup, arrival, customer, feedback },
          loading: false
        });
      })
      .catch(err => {
        console.error('loadAllOrders error', err);
        wx.showToast({ title: '订单加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  openOrderDetail(e) {
    const item = e.currentTarget.dataset.item || {};
    const orderId = item._id || item.id || '';
    if (!orderId) {
      wx.showToast({ title: '订单ID异常', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/merchant/order/detail/detail?orderId=${orderId}` });
  },

  oneKeyReminder() {
    this.pushOrderReminder()
      .then(() => wx.showToast({ title: '提醒已发送', icon: 'success' }))
      .catch(err => {
        console.error('pushOrderReminder error', err);
        wx.showToast({ title: '提醒失败', icon: 'none' });
      });
  },

  /**
   * 获取商品列表（待取货/待到货）
   * @param {string} type - 'pickup' 待取货 / 'arrival' 待到货
   * @returns {Promise<Array>}
   */
  fetchGoodsListFromServer(type) {
    // TODO：后端实现，从 goods 表查询
    // 待取货：pickupStatus === '待取货'
    // 待到货：pickupStatus === '未到货'
    return Promise.resolve([]);
  },

  /**
   * 获取顾客订单列表
   * @returns {Promise<Array>} 从 orders 表查询
   * 返回数据结构：
   * [{
   *   _id: String,
   *   orderNo: String,
   *   customerName: String,      // customerInfo.name
   *   totalQty: Number,          // goods 数组总数量
   *   pickableQty: Number,       // goods 中 pickupStatus === '待取货' 的数量
   *   arrivalStatus: String,     // 'partial' 部分到货 / 'all' 全部到货
   *   status: String
   * }]
   */
  fetchCustomerOrdersFromServer() {
    // TODO：后端实现，从 orders 表查询
    return Promise.resolve([
      {
        _id: 'o003',
        orderNo: 'ORD202603270001',
        customerName: 'YMC',
        totalQty: 5,
        pickableQty: 4,
        arrivalStatus: 'partial',
        status: '待取货'
      },
      {
        _id: 'o004',
        orderNo: 'ORD202603270002',
        customerName: 'YMCA',
        totalQty: 5,
        pickableQty: 5,
        arrivalStatus: 'all',
        status: '待取货'
      }
    ]);
  },

  /**
   * 获取售后反馈列表
   * @returns {Promise<Array>}
   */
  fetchFeedbackListFromServer() {
    // TODO：后端实现
    return Promise.resolve([]);
  },

  pushOrderReminder() {
    // TODO：后端实现，提醒全部待处理订单
    // return wx.cloud.callFunction({ name: 'pushOrderReminder' });
    return Promise.resolve();
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    // 当前页为订单处理，不跳转
    if (tab === 'order') return;
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      order: '/pages/merchant/order/order',
    };
    const url = map[tab];
    if (url) wx.navigateTo({ url });
  }
});