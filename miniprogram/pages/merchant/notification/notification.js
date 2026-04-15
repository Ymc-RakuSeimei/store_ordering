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
    loading: true,
    reminderLoading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '消息中心' });
    this.recordViewTime();
    this.loadNotifications();
  },

  onShow() {
    this.recordViewTime();
  },

  recordViewTime() {
    try {
      wx.setStorageSync('merchant_last_notification_view_time', Date.now());
    } catch (e) {
      console.error('recordViewTime error', e);
    }
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.redirectTo({ url: '/pages/merchant/index/index' });
      }
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  loadNotifications() {
    this.setData({ loading: true });
    Promise.all([
      this.fetchGoodsListFromServer(),
      this.fetchFeedbackListFromServer()
    ])
      .then(([goodsList, feedbackList]) => {
        const filteredFeedbackList = this.filterDeletedFeedback(feedbackList);
        const notifications = this.generateNotifications(goodsList);
        const allNotifications = this.mergeAndSortNotifications(notifications, filteredFeedbackList);
        this.setData({ notifications, feedbackList: filteredFeedbackList, allNotifications, loading: false });
      })
      .catch(err => {
        console.error('loadNotifications error', err);
        wx.showToast({ title: '通知加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  filterDeletedFeedback(feedbackList) {
    const deletedIds = wx.getStorageSync('merchant_deleted_feedback_ids') || [];
    return feedbackList.filter(item => !deletedIds.includes(item.id));
  },

  mergeAndSortNotifications(notifications, feedbackList) {
    const now = Date.now();

    const notificationsWithTime = notifications.map(item => ({
      ...item,
      isFeedback: false,
      timestamp: now
    }));

    const feedbackWithTime = feedbackList.map(item => ({
      ...item,
      isFeedback: true,
      timestamp: this.parseTime(item.createdAt)
    }));

    return [...notificationsWithTime, ...feedbackWithTime]
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  parseTime(timeStr) {
    if (!timeStr) return 0;
    const date = new Date(timeStr);
    const ts = date.getTime();
    return isNaN(ts) ? 0 : ts;
  },

  generateNotifications(goodsList) {
    const notifications = [];
    const now = new Date();

    goodsList.forEach((item, index) => {
      const itemType = item.type || 'spot';

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

  onDeleteAll() {
    const { activeTab, allNotifications, notifications, feedbackList } = this.data;

    let deleteType = '';
    let hasFeedback = false;
    let messagesToDelete = [];

    switch (activeTab) {
      case 'all':
        deleteType = '所有消息';
        hasFeedback = allNotifications.some(item => item.isFeedback);
        messagesToDelete = allNotifications;
        break;
      case 'inventory':
        deleteType = '库存提醒';
        hasFeedback = false;
        messagesToDelete = notifications.filter(item => item.type === 'inventory');
        break;
      case 'retention':
        deleteType = '滞留预警';
        hasFeedback = false;
        messagesToDelete = notifications.filter(item => item.type === 'retention');
        break;
      case 'feedback':
        deleteType = '售后反馈';
        hasFeedback = true;
        messagesToDelete = feedbackList;
        break;
    }

    let content = `确定要删除所有${deleteType}吗？`;
    if (hasFeedback) {
      content = `确定要删除所有${deleteType}吗？\n\n⚠️ 注意：其中包含售后反馈消息，删除后将无法恢复，请谨慎操作！`;
    } else if (activeTab === 'all') {
      content = `确定要删除所有${deleteType}吗？\n\n注：库存提醒和滞留预警为实时计算消息，下次进入页面会根据商品状态重新生成。`;
    }

    wx.showModal({
      title: '确认删除',
      content: content,
      confirmColor: '#ff3b30',
      success: async (res) => {
        if (res.confirm) {
          if (hasFeedback) {
            const confirmRes = await this.showFeedbackConfirm();
            if (!confirmRes) return;
          }

          try {
            await this.deleteMessagesByTab(activeTab, messagesToDelete);
            wx.showToast({ title: '已删除', icon: 'success' });
          } catch (err) {
            console.error('deleteAllNotifications error', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  showFeedbackConfirm() {
    return new Promise((resolve) => {
      wx.showModal({
        title: '⚠️ 重要提醒',
        content: '售后反馈消息删除后将永久丢失，确定要继续吗？',
        confirmText: '确定删除',
        confirmColor: '#ff3b30',
        cancelText: '取消',
        success: (res) => {
          resolve(res.confirm);
        }
      });
    });
  },

  async deleteMessagesByTab(tab, messages) {
    const { notifications, feedbackList, allNotifications } = this.data;

    switch (tab) {
      case 'all':
        const feedbackIds = feedbackList.map(item => item.id);
        if (feedbackIds.length > 0) {
          await this.deleteFeedbackFromServer(feedbackIds);
          const existingDeletedIds = wx.getStorageSync('merchant_deleted_feedback_ids') || [];
          const allDeletedIds = [...new Set([...existingDeletedIds, ...feedbackIds])];
          wx.setStorageSync('merchant_deleted_feedback_ids', allDeletedIds);
        }
        this.setData({
          notifications: [],
          feedbackList: [],
          allNotifications: []
        });
        break;

      case 'inventory':
        const remainingNotifications = notifications.filter(item => item.type !== 'inventory');
        this.setData({
          notifications: remainingNotifications,
          allNotifications: this.mergeAndSortNotifications(remainingNotifications, feedbackList)
        });
        break;

      case 'retention':
        const remainingNotifications2 = notifications.filter(item => item.type !== 'retention');
        this.setData({
          notifications: remainingNotifications2,
          allNotifications: this.mergeAndSortNotifications(remainingNotifications2, feedbackList)
        });
        break;

      case 'feedback':
        const idsToDelete = messages.map(item => item.id);
        if (idsToDelete.length > 0) {
          await this.deleteFeedbackFromServer(idsToDelete);
          const existingDeletedIds = wx.getStorageSync('merchant_deleted_feedback_ids') || [];
          const allDeletedIds = [...new Set([...existingDeletedIds, ...idsToDelete])];
          wx.setStorageSync('merchant_deleted_feedback_ids', allDeletedIds);
        }
        const remainingFeedback = feedbackList.filter(item => !idsToDelete.includes(item.id));
        this.setData({
          feedbackList: remainingFeedback,
          allNotifications: this.mergeAndSortNotifications(notifications, remainingFeedback)
        });
        break;
    }
  },

  async deleteFeedbackFromServer(feedbackIds) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteFeedbackBatch',
        data: {
          ids: Array.isArray(feedbackIds) ? feedbackIds : [feedbackIds]
        }
      });
      if (res.result.code !== 0) {
        console.error('删除售后反馈失败:', res.result.message);
      }
    } catch (error) {
      console.error('调用删除售后反馈接口失败:', error);
    }
  },

  onRemind(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '确认发送提醒',
      content: `确定要给未取「${item.name}」的顾客发送提醒吗？`,
      success: (res) => {
        if (res.confirm) {
          this.setData({ reminderLoading: true });
          this.requestNotificationReminder(item)
            .then((result) => {
              this.setData({ reminderLoading: false });
              const count = result && result.userCount ? result.userCount : 0;
              wx.showModal({
                title: '提醒成功',
                content: `已提醒 ${count} 位顾客`,
                showCancel: false
              });
            })
            .catch(err => {
              this.setData({ reminderLoading: false });
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

  deleteAllNotifications() {
    return Promise.resolve();
  },

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

  fetchFeedbackListFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchFeedbackList'
    }).then(res => {
      const result = res.result || {};
      if (result.code === 0) {
        return result.data || [];
      }
      throw new Error(result.message || '获取反馈列表失败');
    }).catch(err => {
      console.error('fetchFeedbackListFromServer error', err);
      return [];
    });
  },

  onViewFeedbackDetail(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    const dataStr = encodeURIComponent(JSON.stringify(item));
    wx.navigateTo({
      url: `/pages/merchant/notification/feedback-detail/feedback-detail?id=${item.id}&data=${dataStr}`
    });
  },

  onDelete(e) {
    const item = e.currentTarget.dataset.item;
    const type = e.currentTarget.dataset.type;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '删除中...' });

        if (type === 'feedback') {
          this.deleteFeedbackFromServer(item.id || item._id)
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.loadNotifications();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('deleteFeedback error', err);
              wx.showToast({ title: err.message || '删除失败', icon: 'none' });
            });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.loadNotifications();
        }
      }
    });
  }
});