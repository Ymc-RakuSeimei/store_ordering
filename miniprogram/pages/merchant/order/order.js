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

  // 商家订单页的待取货/未到货列表统一从云函数获取。
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

  fetchFeedbackListFromServer() {
    return Promise.resolve([]);
  },

  onMarkArrived(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '该商品';

    wx.showModal({
      title: '确认到货',
      content: `确认「${name}」已经到货吗？`,
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '处理中...' });

        this.markGoodsArrivedOnServer(id)
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已更新为到货', icon: 'success' });
            this.setData({ activeTab: 'pickup' });
            this.loadAllOrders();
          })
          .catch((err) => {
            wx.hideLoading();
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
        if (res.confirm) {
          wx.showLoading({ title: '发送中...' });
          this.pushOrderReminder()
            .then((totalCount) => {
              wx.hideLoading();
              wx.showModal({
                title: '提醒成功',
                content: `已提醒 ${totalCount} 位顾客`,
                showCancel: false
              });
            })
            .catch((err) => {
              wx.hideLoading();
              console.error('pushOrderReminder error', err);
              wx.showModal({
                title: '提醒失败',
                content: '发送提醒时出错，请稍后重试',
                showCancel: false
              });
            });
        }
      }
    });
  },

  pushOrderReminder() {
    return new Promise(async (resolve, reject) => {
      try {
        // 获取待取货商品列表
        const pickupGoods = this.data.orderData.pickup || [];
        
        if (pickupGoods.length === 0) {
          resolve(0);
          return;
        }
        
        let totalCount = 0;
        
        // 为每个待取货商品发送提醒
        for (const goods of pickupGoods) {
          try {
            const res = await wx.cloud.callFunction({
              name: 'sendPickupReminder',
              data: {
                goodsId: goods.id || goods._id,
                goodsName: goods.name,
                stock: goods.stock
              }
            });
            
            if (res.result.code === 0) {
              totalCount += res.result.userCount || 0;
            }
          } catch (err) {
            console.error(`发送提醒失败 for ${goods.name}:`, err);
            // 继续处理其他商品
          }
        }
        
        resolve(totalCount);
      } catch (err) {
        reject(err);
      }
    });
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
      wx.showToast({ title: '请输入6位数字取货码', icon: 'none' });
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