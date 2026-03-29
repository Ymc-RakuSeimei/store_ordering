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
    const { tab } = e.currentTarget.dataset;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  loadAllOrders() {
    this.setData({ loading: true });

    const statusMap = {
      pickup: '待取货',
      arrival: '待到货',
      customer: '顾客订单',
      feedback: '售后反馈'
    };

    const tasks = Object.keys(statusMap).map((key) =>
      this.fetchOrderListFromServer(statusMap[key]).then((list) => ({ key, list }))
    );

    Promise.all(tasks)
      .then((results) => {
        const orderData = {
          pickup: [],
          arrival: [],
          customer: [],
          feedback: []
        };

        results.forEach(({ key, list }) => {
          orderData[key] = Array.isArray(list) ? list : [];
        });

        this.setData({
          orderData,
          loading: false
        });
      })
      .catch((err) => {
        console.error('loadAllOrders error', err);
        wx.showToast({ title: '订单加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  openOrderDetail(e) {
    const item = e.currentTarget.dataset.item || {};
    const orderId = item.orderId || item._id || item.id || '';

    if (!orderId) {
      wx.showToast({ title: '订单信息异常', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/merchant/order/detail/detail?orderId=${orderId}`
    });
  },

  oneKeyReminder() {
    this.pushOrderReminder()
      .then(() => {
        wx.showToast({ title: '提醒已发送', icon: 'success' });
      })
      .catch((err) => {
        console.error('pushOrderReminder error', err);
        wx.showToast({ title: '提醒发送失败', icon: 'none' });
      });
  },

  fetchOrderListFromServer(status) {
    const placeholder = {
      待取货: [
        { _id: 'o001', name: '派大星手套', qty: 5, left: 2, spec: '50个/袋' }
      ],
      待到货: [
        { _id: 'o002', name: '海绵宝宝领带', qty: 20, left: 10, spec: '1条' }
      ],
      顾客订单: [
        { _id: 'o003', name: '蟹黄堡秘方', qty: 3, left: 2, spec: '500g' }
      ],
      售后反馈: [
        { _id: 'f001', name: '蟹黄堡过期', qty: 1, spec: '食品变质', left: '待处理' },
        { _id: 'f002', name: '派大星手套破损', qty: 2, spec: '质量问题', left: '已处理' }
      ]
    };

    return Promise.resolve(placeholder[status] || []);
  },

  pushOrderReminder() {
    return Promise.resolve();
  },

  onTabTap(e) {
    const { tab } = e.currentTarget.dataset;
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my'
    };
    const url = map[tab];

    if (url) {
      wx.navigateTo({ url });
    }
  },

  onPickupCodeInput(e) {
    const pickupCode = String(e.detail.value || '').trim();
    const isPickupCodeValid = /^\d{6}$/.test(pickupCode);

    this.setData({
      pickupCode,
      isPickupCodeValid
    });
  },

  async onVerifyPickupCode() {
    const { pickupCode } = this.data;

    if (!/^\d{6}$/.test(pickupCode)) {
      wx.showToast({ title: '请输入6位数字取货码', icon: 'none' });
      return;
    }

    try {
      this.setData({ loading: true });

      await new Promise((resolve) => setTimeout(resolve, 300));

      wx.navigateTo({
        url: `/pages/merchant/verify/verify?code=${pickupCode}`
      });
    } catch (error) {
      console.error('onVerifyPickupCode error', error);
      wx.showToast({ title: '取货码验证失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onScanPickup() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const pickupCode = String(res.result || '').trim();

        if (!/^\d{6}$/.test(pickupCode)) {
          wx.showToast({ title: '扫码结果不是有效取货码', icon: 'none' });
          return;
        }

        wx.navigateTo({
          url: `/pages/merchant/verify/verify?code=${pickupCode}`
        });
      },
      fail: (error) => {
        console.error('onScanPickup error', error);
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      }
    });
  }
});
