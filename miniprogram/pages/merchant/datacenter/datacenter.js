Page({
  data: {
    stats: {
      totalRevenue: 0.00,
      totalCost: 0.00,
      netProfit: 0.00
    },
    orderSummary: {
      delivered: 0,
      pickedUp: 0,
      pendingPickup: 0
    },
    loading: true
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '数据中心' });
    this.loadDataCenter();
  },

  onBack() {
    wx.navigateBack();
  },

  // 入口：并行拉取营收统计 + 订单状态统计
  loadDataCenter() {
    this.setData({ loading: true });

    // TODO: 以下后端函数仅提供接口名与样式，后端实现为数据库查询
    const p1 = this.fetchDataCenterStats();
    const p2 = this.fetchOrderStatusStats();

    Promise.all([p1, p2])
      .then(([stats, orderSummary]) => {
        this.setData({
          stats: stats || this.data.stats,
          orderSummary: orderSummary || this.data.orderSummary,
          loading: false
        });
      })
      .catch(err => {
        console.error('loadDataCenter error', err);
        wx.showToast({ title: '数据加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  // ---------------- 后端接口占位 ----------------

  /**
   * 获取本月总收入/总成本/净利润
   * 由后端实现，可带默认时间维度（本月/本周/本日）
   * 返回 Promise.resolve({ totalRevenue, totalCost, netProfit })
   */
  fetchDataCenterStats() {
    // 示例：
    // return wx.cloud.callFunction({ name: 'getDataCenterStats', data: { period: 'month' } });
    return Promise.resolve({
      totalRevenue: 12345.65,
      totalCost: 10000.65,
      netProfit: 2345.00
    });
  },

  /**
   * 获取订单状态统计：已到货、已取货、待取货
   * 返回 Promise.resolve({ delivered, pickedUp, pendingPickup })
   */
  fetchOrderStatusStats() {
    // 示例：
    // return wx.cloud.callFunction({ name: 'getOrderStatusCounts' });
    return Promise.resolve({
      delivered: 8,
      pickedUp: 12,
      pendingPickup: 3
    });
  },

  /**
   * 一键提醒，调用后端接口通知待取货客户
   * 后端函数名示例：'pushOrderReminder'
   */
  onOneKeyReminder() {
    this.pushOrderReminder().then(() => {
      wx.showToast({ title: '提醒已发送', icon: 'success' });
    }).catch(err => {
      console.error('onOneKeyReminder error', err);
      wx.showToast({ title: '提醒失败', icon: 'none' });
    });
  },

  /**
   * 后端接口占位：提醒接口
   * 返回 Promise
   */
  pushOrderReminder() {
    // 示例：
    // return wx.cloud.callFunction({ name: 'pushOrderReminder' });
    return Promise.resolve();
  }
});