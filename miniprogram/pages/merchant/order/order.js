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
    loading: true,
    // 取货码快捷入口相关
    pickupCode: '',
    isPickupCodeValid: false
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

    const statusMap = { pickup: '待取货', arrival: '待到货', customer: '顾客订单', feedback: '售后反馈' };
    const promises = Object.keys(statusMap).map(key =>
      this.fetchOrderListFromServer(statusMap[key]).then(list => ({ key, list }))
    );

    Promise.all(promises)
      .then(results => {
        const orderData = { pickup: [], arrival: [], customer: [], feedback: [] };
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
        { _id: 'o003', name: '蟹黄堡秘方', qty: 3, spec: '500g', left: 2 }
      ],
      '售后反馈': [
        { _id: 'f001', name: '蟹黄堡过期', qty: 1, spec: '食品变质', left: '待处理' },
        { _id: 'f002', name: '派大星手套破损', qty: 2, spec: '质量问题', left: '已处理' }
      ]
    };

    return Promise.resolve(placeholder[status] || []);
  },

  pushOrderReminder() {
    // TODO：后端实现，提醒全部待处理订单
    // return wx.cloud.callFunction({ name: 'pushOrderReminder' });
    return Promise.resolve();
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my',
    };
    const url = map[tab];
    if (url) wx.navigateTo({ url });
  }
});
    // 当前页为订单处理，不跳转
    if (tab === 'order') return;
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      order: '/pages/merchant/order/order',
    };
    const url = map[tab];
    if (url) wx.navigateTo({ url });
  },

  // 取货码输入处理
  onPickupCodeInput(e) {
    const pickupCode = e.detail.value;
    // 实时验证输入是否为6位数字
    const isPickupCodeValid = /^\d{6}$/.test(pickupCode);
    this.setData({
      pickupCode,
      isPickupCodeValid
    });
  },

  // 验证取货码并跳转到核销页面
  async onVerifyPickupCode() {
    const { pickupCode } = this.data;
    
    // 再次验证取货码格式
    if (!/^\d{6}$/.test(pickupCode)) {
      wx.showToast({ title: '请输入6位数字取货码', icon: 'none' });
      return;
    }
    
    try {
      this.setData({ loading: true });
      
      // 模拟验证取货码是否存在
      // 实际项目中应该调用后端API验证取货码
      await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络请求延迟
      
      // 假设取货码验证成功，跳转到核销页面
      wx.navigateTo({
        url: `/pages/merchant/verify/verify?code=${pickupCode}`
      });
    } catch (error) {
      console.error('验证取货码失败:', error);
      wx.showToast({ title: '取货码验证失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 扫码取货
  onScanPickup() {
    wx.scanCode({
      success: (res) => {
        // 假设扫码结果是取货码
        const pickupCode = res.result;
        if (/^\d{6}$/.test(pickupCode)) {
          wx.navigateTo({
            url: `/pages/merchant/verify/verify?code=${pickupCode}`
          });
        } else {
          wx.showToast({ title: '扫码结果不是有效的取货码', icon: 'none' });
        }
      },
      fail: (error) => {
        console.error('扫码失败:', error);
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      }
    });
  }
});
