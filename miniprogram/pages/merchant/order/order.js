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
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my',
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