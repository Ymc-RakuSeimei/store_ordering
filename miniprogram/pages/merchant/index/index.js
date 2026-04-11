// pages/merchant/index/index.js
Page({
  data: {
    userName: '店长ymc',
    avatar: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png',
    cardGroup: [
      { id: 'product', title: '商品管理', subtitle: '上架新品、编辑库存', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_product.png' },
      { id: 'order', title: '订单处理', subtitle: '顾客订单、售后提醒', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_ord.png' },
      { id: 'data', title: '数据中心', subtitle: '销售统计、营收查看', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_data.png' },
      { id: 'preorder', title: '预售接龙', subtitle: '设置群接龙、统计进货', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_preord.png' }
    ],
    notify: { id: 'notify', title: '系统通知', subtitle: '库存、订单、预售提醒', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_notice.png' },
    hasNewNotification: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '商家管理' });
    this.checkNewNotifications();
  },

  onShow() {
    this.checkNewNotifications();
  },

  // 检查是否有新通知
  checkNewNotifications() {
    try {
      const lastViewTime = wx.getStorageSync('merchant_last_notification_view_time') || 0;

      // 获取通知列表并检查是否有新通知
      Promise.all([
        this.fetchGoodsListFromServer(),
        this.fetchFeedbackListFromServer()
      ]).then(([goodsList, feedbackList]) => {
        const hasNew = this.hasNewNotificationsSince(goodsList, feedbackList, lastViewTime);
        this.setData({ hasNewNotification: hasNew });
      }).catch(err => {
        console.error('checkNewNotifications error', err);
      });
    } catch (e) {
      console.error('checkNewNotifications error', e);
    }
  },

  // 检查是否有新通知
  hasNewNotificationsSince(goodsList, feedbackList, lastViewTime) {
    const now = Date.now();

    // 检查库存提醒和滞留预警（只要有就认为是新的）
    for (const item of goodsList) {
      const itemType = item.type || 'spot';

      // 库存提醒
      if (itemType === 'spot' || itemType === 'special') {
        const stock = item.stock || 0;
        const totalBooked = item.totalBooked || 0;
        if (stock > 0 && totalBooked >= stock * 0.7) {
          return true;
        }
      }

      // 滞留预警
      if (item.status === '已到货' && item.arrivedAt) {
        const arrivedDate = new Date(item.arrivedAt).getTime();
        const diffDays = Math.floor((now - arrivedDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 2) {
          return true;
        }
      }
    }

    // 检查售后反馈
    for (const item of feedbackList) {
      const createdTime = this.parseTime(item.createdAt);
      if (createdTime > lastViewTime) {
        return true;
      }
    }

    return false;
  },

  parseTime(timeStr) {
    if (!timeStr) return 0;
    const date = new Date(timeStr);
    const ts = date.getTime();
    return isNaN(ts) ? 0 : ts;
  },

  fetchGoodsListFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchGoodsList'
    }).then(res => {
      if (res.result.code === 0) {
        return res.result.data || [];
      }
      return [];
    }).catch(err => {
      console.error('fetchGoodsListFromServer error', err);
      return [];
    });
  },

  fetchFeedbackListFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchFeedbackList'
    }).then(res => {
      const result = res.result || {};
      if (result.code === 0) {
        return result.data || [];
      }
      return [];
    }).catch(err => {
      console.error('fetchFeedbackListFromServer error', err);
      return [];
    });
  },

  onScanPickup() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const code = res.result;
        if (!code) {
          wx.showToast({ title: '扫码结果为空', icon: 'none' });
          return;
        }
        wx.navigateTo({
          url: `/pages/merchant/verify/verify?code=${encodeURIComponent(code)}`
        });
      },
      fail: () => {
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      }
    });
  },

  onCardTap(event) {
    const id = event.currentTarget.dataset.id;
    const map = {
      product: '/pages/merchant/product/product',
      order: '/pages/merchant/order/order',
      data: '/pages/merchant/datacenter/datacenter',
      preorder: '/pages/merchant/preorder/preorder',
      notify: '/pages/merchant/notification/notification'
    };
    const url = map[id];
    if (url) {
      // 如果点击的是系统通知，记录当前时间为最后查看时间
      if (id === 'notify') {
        try {
          wx.setStorageSync('merchant_last_notification_view_time', Date.now());
          this.setData({ hasNewNotification: false });
        } catch (e) {
          console.error('save last view time error', e);
        }
      }
      wx.navigateTo({ url });
    }
  },

  openAiAssistant() {
    wx.navigateTo({
      url: '/pages/ai-assistant/index?role=merchant&sourcePage=merchant_index'
    });
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') return;

    const map = {
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my'
    };
    const url = map[tab];
    if (url) {
      wx.redirectTo({ url });
    }
  }
});
