Page({
  data: {
    activeTab: 'all',
    tabs: [
      { id: 'all', label: '全部' },
      { id: 'inventory', label: '库存提醒' },
      { id: 'retention', label: '滞留预警' },
      { id: 'feedback', label: '售后反馈' }
    ],
    notifications: [],
    feedbackList: [],
    allNotifications: [],
    loading: true
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '消息中心' });
    this.loadNotifications();
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.redirectTo({ url: '/pages/merchant/index/index' });
      }
    });
  },

  // tab 切换
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  // 加载通知列表
  loadNotifications() {
    this.setData({ loading: true });
    Promise.all([
      this.fetchGoodsListFromServer(),
      this.fetchFeedbackListFromServer()
    ])
      .then(([goodsList, feedbackList]) => {
        const notifications = this.generateNotifications(goodsList);
        const allNotifications = this.mergeAndSortNotifications(notifications, feedbackList);
        this.setData({ notifications, feedbackList, allNotifications, loading: false });
      })
      .catch(err => {
        console.error('loadNotifications error', err);
        wx.showToast({ title: '通知加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  // 合并并按时间排序所有通知
  mergeAndSortNotifications(notifications, feedbackList) {
    const now = Date.now();

    // 给库存提醒和滞留预警添加时间戳
    const notificationsWithTime = notifications.map(item => ({
      ...item,
      isFeedback: false,
      timestamp: now // 这两类通知没有具体时间，用当前时间
    }));

    // 给售后反馈添加时间戳
    const feedbackWithTime = feedbackList.map(item => ({
      ...item,
      isFeedback: true,
      timestamp: this.parseTime(item.createdAt)
    }));

    // 合并并按时间倒序排列
    return [...notificationsWithTime, ...feedbackWithTime]
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  // 解析时间字符串为时间戳
  parseTime(timeStr) {
    if (!timeStr) return 0;
    const date = new Date(timeStr);
    const ts = date.getTime();
    return isNaN(ts) ? 0 : ts;
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
              wx.showModal({
                title: '提醒成功',
                content: `已提醒 ${count} 位顾客`,
                showCancel: false
              });
            })
            .catch(err => {
              wx.hideLoading();
              console.error('requestNotificationReminder error', err);
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
  },

  /**
   * 获取售后反馈列表
   * @returns {Promise<Array>}
   */
  fetchFeedbackListFromServer() {
    console.log('Calling fetchFeedbackList cloud function...');
    return wx.cloud.callFunction({
      name: 'fetchFeedbackList'
    }).then(res => {
      console.log('fetchFeedbackList response:', res);
      const result = res.result || {};
      console.log('fetchFeedbackList result:', result);
      if (result.code === 0) {
        const data = result.data || [];
        console.log('Feedback data:', data);
        return data;
      }
      throw new Error(result.message || '获取反馈列表失败');
    }).catch(err => {
      console.error('fetchFeedbackListFromServer error', err);
      // 失败时返回空数组
      return [];
    });
  },

  /**
   * 查看反馈详情
   */
  onViewFeedbackDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    // 将数据编码后传递
    const dataStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({
      url: `/pages/merchant/notification/feedback-detail/feedback-detail?id=${item.id}&data=${dataStr}`
    });
  }
});