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
    wx.setNavigationBarTitle({ title: '系统通知' });
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

  // 加载通知列表，直接调用后端接口占位
  loadNotifications() {
    this.setData({ loading: true });
    this.fetchNotificationListFromServer()
      .then(res => {
        // 后端返回 [{id, type, text, tips}]
        this.setData({ notifications: res || [], loading: false });
      })
      .catch(err => {
        console.error('loadNotifications error', err);
        wx.showToast({ title: '通知加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
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
    const id = e.currentTarget.dataset.id;
    this.requestNotificationReminder(id)
      .then(() => {
        wx.showToast({ title: '提醒已发送', icon: 'success' });
      })
      .catch(err => {
        console.error('requestNotificationReminder error', err);
        wx.showToast({ title: '提醒失败', icon: 'none' });
      });
  },

  // ---------------- 后端接口占位 ----------------

  /**
   * 测试占位通知列表, 后端替换为数据库查询逻辑
   * 可能返回结构：[{ id, type, title, text, subText, showRemindAction }]
   */
  fetchNotificationListFromServer() {
    // TODO: 后端调用示例：wx.cloud.callFunction({ name: 'fetchNotifications' })
    return Promise.resolve([
      { id: 'n001', type: 'inventory', text: '商品A库存已不足10件', showRemindAction: false },
      { id: 'n002', type: 'retention', text: '商品B仍有4件未取，已到货x天', showRemindAction: true }
    ]);
  },

  /**
   * 一键删除所有通知（后端实现）
   */
  deleteAllNotifications() {
    // TODO: 后端实现，例如：wx.cloud.callFunction({ name: 'deleteAllNotifications' })
    return Promise.resolve();
  },

  /**
   * 通知提醒接口（后端实现）
   */
  requestNotificationReminder(id) {
    // TODO: 后端实现，例如：wx.cloud.callFunction({ name: 'remindNotification', data: { id } })
    return Promise.resolve();
  }
});