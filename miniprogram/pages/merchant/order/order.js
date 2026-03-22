Page({
  data: {
    activeTab: 'pickup',
    tabs: [
      { id: 'pickup', label: '待取货' },
      { id: 'arrival', label: '待到货' },
      { id: 'customer', label: '顾客订单' }
    ],
    orderData: {
      pickup: [],
      arrival: [],
      customer: []
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

    const statusMap = { pickup: '待取货', arrival: '待到货', customer: '顾客订单' };
    const promises = Object.keys(statusMap).map(key =>
      this.fetchOrderListFromServer(statusMap[key]).then(list => ({ key, list }))
    );

    Promise.all(promises)
      .then(results => {
        const orderData = { pickup: [], arrival: [], customer: [] };
        results.forEach(item => { orderData[item.key] = item.list || []; });
        this.setData({ orderData, loading: false });
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

  fetchOrderListFromServer(status) {
    // TODO：后端实现，wxml已调用
    // 示例后端调用：wx.cloud.callFunction({ name: 'fetchOrderList', data: { status }});
    // 这里先提供本地占位数据，后端可直接替换为真实接口。

    const placeholder = {
      '待取货': [
        { _id: 'o001', name: '派大星手套', qty: 5, left: 2, spec: '50个/袋' }
      ],
      '待到货': [
        { _id: 'o002', name: '海绵宝宝领带', qty: 20, left: 10, spec: '1条' }
      ],
      '顾客订单': [
        { _id: 'o003', name: '蟹黄堡秘方', qty: 3, spec: '500g' }
      ]
    };

    return Promise.resolve(placeholder[status] || []);
  },

  pushOrderReminder() {
    // TODO：后端实现，提醒全部待处理订单
    // return wx.cloud.callFunction({ name: 'pushOrderReminder' });
    return Promise.resolve();
  }
});