Page({
  data: {
    activeTab: 'pickup',
    tabs: [
      { id: 'pickup', label: '待取货' },
      { id: 'arrival', label: '未到货' },
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
    markLoading: false,
    reminderLoading: false,
    pickupCode: '',
    isPickupCodeValid: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '订单处理' });
    this.loadAllOrders();
  },

  onShow() {
    this.loadAllOrders();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  loadAllOrders() {
    this.setData({ loading: true });

    Promise.all([
      this.fetchGoodsListFromServer('pickup'),
      this.fetchGoodsListFromServer('arrival'),
      this.fetchCustomerOrdersFromServer(),
      this.fetchFeedbackListFromServer()
    ])
      .then(([pickup, arrival, customer, feedback]) => {
        const nextActiveTab = this.data.activeTab === 'pickup' && pickup.length === 0 && arrival.length > 0
          ? 'arrival'
          : this.data.activeTab;

        this.setData({
          activeTab: nextActiveTab,
          orderData: { pickup, arrival, customer, feedback },
          loading: false
        });
      })
      .catch((err) => {
        console.error('loadAllOrders error', err);
        wx.showToast({ title: '订单加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  // “待取货 / 未到货”两类商品统一走同一个云函数，靠 type 区分返回数据。
  fetchGoodsListFromServer(type) {
    return wx.cloud.callFunction({
      name: 'getMerchantOrderGoods',
      data: { type }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取商品列表失败');
      }
      return result.data || [];
    });
  },

  fetchCustomerOrdersFromServer() {
    return wx.cloud.callFunction({
      name: 'getMerchantOrderGoods',
      data: { type: 'customer' }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取顾客订单失败');
      }
      return result.data || [];
    });
  },

  fetchFeedbackListFromServer() {
    return Promise.resolve([]);
  },

  openCustomerDetail(e) {
    const customerKey = e.currentTarget.dataset.customerKey;
    if (!customerKey) {
      wx.showToast({ title: '缺少顾客标识', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/merchant/order/detail/detail?customerKey=${encodeURIComponent(customerKey)}`
    });
  },

  // 商品卡片点击后进入“该商品的买家汇总页”。
  openGoodsDetail(e) {
    const goodsId = String(e.currentTarget.dataset.goodsId || '').trim();
    const docId = String(e.currentTarget.dataset.docId || '').trim();

    if (!goodsId && !docId) {
      wx.showToast({ title: '缺少商品标识', icon: 'none' });
      return;
    }

    const query = [];
    if (goodsId) {
      query.push(`goodsId=${encodeURIComponent(goodsId)}`);
    }
    if (docId) {
      query.push(`docId=${encodeURIComponent(docId)}`);
    }

    wx.navigateTo({
      url: `/pages/merchant/order/goods-detail/goods-detail?${query.join('&')}`
    });
  },

  onMarkArrived(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该商品';

    wx.showModal({
      title: '确认到货',
      content: `确认“${name}”已经到货吗？到货后会自动提醒相关买家一次。`,
      success: (res) => {
        if (!res.confirm) return;

        this.setData({ markLoading: true });

        this.markGoodsArrivedOnServer(id)
          .then((result) => {
            this.setData({ markLoading: false });
            const reminderCount = Number(result && result.reminderCount) || 0;

            wx.showToast({
              title: reminderCount > 0 ? '已到货并提醒买家' : '已更新为到货',
              icon: 'success'
            });

            this.setData({ activeTab: 'pickup' });
            this.loadAllOrders();
          })
          .catch((err) => {
            this.setData({ markLoading: false });
            console.error('markGoodsArrivedOnServer error', err);
            wx.showToast({ title: err.message || '到货处理失败', icon: 'none' });
          });
      }
    });
  },

  markGoodsArrivedOnServer(id) {
    return wx.cloud.callFunction({
      name: 'markPreorderArrived',
      data: { id }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '到货处理失败');
      }
      return result.data || null;
    });
  },

  oneKeyReminder() {
    wx.showModal({
      title: '一键提醒',
      content: '确定要给所有待取货的顾客发送提醒吗？',
      success: (res) => {
        if (!res.confirm) return;

        this.setData({ reminderLoading: true });
        this.pushOrderReminder()
          .then((totalCount) => {
            this.setData({ reminderLoading: false });
            wx.showModal({
              title: '提醒成功',
              content: `已提醒 ${totalCount} 位顾客`,
              showCancel: false
            });
          })
          .catch((err) => {
            this.setData({ reminderLoading: false });
            console.error('pushOrderReminder error', err);
            wx.showModal({
              title: '提醒失败',
              content: '发送提醒时出错，请稍后重试',
              showCancel: false
            });
          });
      }
    });
  },

  async pushOrderReminder() {
    const pickupGoods = this.data.orderData.pickup || [];

    if (pickupGoods.length === 0) {
      return 0;
    }

    let totalCount = 0;

    for (const goods of pickupGoods) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'sendPickupReminder',
          data: {
            goodsId: goods.goodsId || goods.id || goods.docId,
            goodsName: goods.name,
            stock: goods.stock
          }
        });

        if (res.result && res.result.code === 0) {
          totalCount += res.result.userCount || 0;
        }
      } catch (err) {
        console.error(`sendPickupReminder failed for ${goods.name}:`, err);
      }
    }

    return totalCount;
  },

  onPickupCodeInput(e) {
    const pickupCode = e.detail.value;
    const isPickupCodeValid = /^\d{6}$/.test(pickupCode);
    this.setData({
      pickupCode,
      isPickupCodeValid
    });
  },

  async onVerifyPickupCode() {
    const { pickupCode } = this.data;

    if (!/^\d{6}$/.test(pickupCode)) {
      wx.showToast({ title: '请输入 6 位数字取货码', icon: 'none' });
      return;
    }

    try {
      this.setData({ loading: true });
      await new Promise((resolve) => setTimeout(resolve, 200));

      wx.navigateTo({
        url: `/pages/merchant/verify/verify?code=${pickupCode}`
      });
    } catch (error) {
      console.error('onVerifyPickupCode error', error);
      wx.showToast({ title: '取货码验证失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onScanPickup() {
    wx.scanCode({
      success: (res) => {
        const pickupCode = res.result;
        if (/^\d{6}$/.test(pickupCode)) {
          wx.navigateTo({
            url: `/pages/merchant/verify/verify?code=${pickupCode}`
          });
          return;
        }

        wx.showToast({ title: '扫码结果不是有效的取货码', icon: 'none' });
      },
      fail: (error) => {
        console.error('onScanPickup error', error);
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      }
    });
  }
});
