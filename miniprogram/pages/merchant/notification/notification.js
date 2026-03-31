Page({
  data: {
    activeTab: 'all',
    tabs: [
      { id: 'all', label: '全部' },
      { id: 'inventory', label: '库存提醒' },
      { id: 'retention', label: '滞留预警' }
    ],
    notifications: [],
    loading: true
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '消息中心' });
    this.loadNotifications();
  },

  onBack() {
    wx.navigateBack();
  },

  // tab 切换
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 加载通知列表
  loadNotifications() {
    this.setData({ loading: true });
    this.fetchGoodsListFromServer()
      .then(goodsList => {
        const notifications = this.generateNotifications(goodsList);
        this.setData({ notifications, loading: false });
      })
      .catch(err => {
        console.error('loadNotifications error', err);
        wx.showToast({ title: '通知加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  // 根据 goods 列表生成通知
  generateNotifications(goodsList) {
    const notifications = [];
    const now = new Date();

    goodsList.forEach((item, index) => {
      const itemType = item.type || 'spot';

      // 1. 库存提醒：仅对现货/特价发送预警
      // - type = 现货/特价: stock 表示实际库存，totalBooked 表示已售出
      // - 预警条件：totalBooked >= stock * 0.7
      if (itemType === 'spot' || itemType === 'special') {
        const stock = item.stock || 0;
        const totalBooked = item.totalBooked || 0;
        if (stock > 0 && totalBooked >= stock * 0.7) {
          const percent = Math.round((totalBooked / stock) * 100);
          notifications.push({
            id: `inventory_${item._id || item.goodsId || index}`,
            type: 'inventory',
            goodsId: item._id || item.goodsId,
            name: item.name,
            stock: stock,
            totalBooked: totalBooked,
            text: `${item.name} 库存可能不足`,
            subText: `（已售 ${totalBooked} 件，库存 ${stock} 件，占 ${percent}%）`,
            showRemindAction: false
          });
        }
      }

      // 2. 滞留预警：已到货未取超两天（所有类型都检查）
      if (item.status === '已到货' && item.arrivedAt) {
        const arrivedDate = new Date(item.arrivedAt);
        const diffDays = Math.floor((now - arrivedDate) / (1000 * 60 * 60 * 24));
        if (diffDays >= 2) {
          notifications.push({
            id: `retention_${item._id || item.goodsId || index}`,
            type: 'retention',
            goodsId: item._id || item.goodsId,
            name: item.name,
            stock: item.stock,
            arrivedDays: diffDays,
            text: `${item.name} 已到货 ${diffDays} 天`,
            subText: `库存 ${item.stock} 件未取`,
            showRemindAction: true
          });
        }
      }
    });

    return notifications;
  },

  // 统一删除所有通知
  onDeleteAll() {
    this.deleteAllNotifications().then(() => {
      wx.showToast({ title: '已清空', icon: 'success' });
      this.setData({ notifications: [] });
    }).catch(err => {
      console.error('deleteAllNotifications error', err);
      wx.showToast({ title: '清空失败', icon: 'none' });
    });
  },

  // 逐条提醒操作
  onRemind(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '确认发送提醒',
      content: `确定要给未取「${item.name}」的顾客发送提醒吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '发送中...' });
          this.requestNotificationReminder(item)
            .then((result) => {
              wx.hideLoading();
              const count = result && result.userCount ? result.userCount : 0;
              wx.showToast({ title: `已提醒 ${count} 位顾客`, icon: 'success' });
            })
            .catch(err => {
              wx.hideLoading();
              console.error('requestNotificationReminder error', err);
              wx.showToast({ title: '提醒失败', icon: 'none' });
            });
        }
      }
    });
  },

  // ---------------- 后端接口 ----------------

  /**
   * 获取 goods 列表
   * @returns {Promise<Array>}
   */
  fetchGoodsListFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchGoodsList'
    }).then(res => {
      if (res.result.code === 0) {
        return res.result.data || [];
      }
      throw new Error(res.result.message || '获取失败');
    }).catch(err => {
      console.error('fetchGoodsListFromServer error', err);
      // 失败时返回本地占位数据
      return [
        {
          _id: 'goods001',
          name: '派大星同款手套气球',
          stock: 23,
          totalBooked: 100,
          status: '已到货',
          arrivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        }
      ];
    });
  },

  /**
   * 一键删除所有通知（后端实现）
   */
  deleteAllNotifications() {
    // TODO: 后端实现
    return Promise.resolve();
  },

  /**
   * 通知提醒接口
   * @param {object} item - 通知项
   * @returns {Promise<{userCount: number}>} 返回发送提醒的用户数量
   */
  requestNotificationReminder(item) {
    return wx.cloud.callFunction({
      name: 'sendPickupReminder',
      data: {
        goodsId: item.goodsId || item._id,
        goodsName: item.name,
        stock: item.stock
      }
    }).then(res => {
      if (res.result.code === 0) {
        return res.result;
      }
      throw new Error(res.result.message || '发送失败');
    });
  }
});