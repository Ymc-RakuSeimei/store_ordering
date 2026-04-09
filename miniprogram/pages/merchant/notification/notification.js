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
        // 过滤掉已删除的售后反馈
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

  // 过滤已删除的售后反馈
  filterDeletedFeedback(feedbackList) {
    const deletedIds = wx.getStorageSync('merchant_deleted_feedback_ids') || [];
    return feedbackList.filter(item => !deletedIds.includes(item.id));
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

  // 统一删除所有通知（根据当前标签页）
  onDeleteAll() {
    const { activeTab, allNotifications, notifications, feedbackList } = this.data;

    // 根据当前标签页确定要删除的内容
    let deleteType = '';
    let hasFeedback = false;
    let messagesToDelete = [];

    switch (activeTab) {
      case 'all':
        deleteType = '所有消息';
        // 检查是否包含售后反馈
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

    // 构建确认提示内容
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
          // 如果包含售后反馈，增加二次确认
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

  // 售后反馈二次确认
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

  // 根据标签页删除消息
  async deleteMessagesByTab(tab, messages) {
    const { notifications, feedbackList, allNotifications } = this.data;

    switch (tab) {
      case 'all':
        // 删除全部：清空所有消息
        // 1. 删除售后反馈
        const feedbackIds = feedbackList.map(item => item.id);
        if (feedbackIds.length > 0) {
          await this.deleteFeedbackFromServer(feedbackIds);
          const existingDeletedIds = wx.getStorageSync('merchant_deleted_feedback_ids') || [];
          const allDeletedIds = [...new Set([...existingDeletedIds, ...feedbackIds])];
          wx.setStorageSync('merchant_deleted_feedback_ids', allDeletedIds);
        }
        // 2. 清空所有数据
        this.setData({
          notifications: [],
          feedbackList: [],
          allNotifications: []
        });
        break;

      case 'inventory':
        // 删除库存提醒：从 notifications 中移除 inventory 类型
        const remainingNotifications = notifications.filter(item => item.type !== 'inventory');
        this.setData({
          notifications: remainingNotifications,
          allNotifications: this.mergeAndSortNotifications(remainingNotifications, feedbackList)
        });
        break;

      case 'retention':
        // 删除滞留预警：从 notifications 中移除 retention 类型
        const remainingNotifications2 = notifications.filter(item => item.type !== 'retention');
        this.setData({
          notifications: remainingNotifications2,
          allNotifications: this.mergeAndSortNotifications(remainingNotifications2, feedbackList)
        });
        break;

      case 'feedback':
        // 删除售后反馈
        const idsToDelete = messages.map(item => item.id);
        if (idsToDelete.length > 0) {
          await this.deleteFeedbackFromServer(idsToDelete);
          const existingDeletedIds = wx.getStorageSync('merchant_deleted_feedback_ids') || [];
          const allDeletedIds = [...new Set([...existingDeletedIds, ...idsToDelete])];
          wx.setStorageSync('merchant_deleted_feedback_ids', allDeletedIds);
        }
        // 更新 feedbackList
        const remainingFeedback = feedbackList.filter(item => !idsToDelete.includes(item.id));
        this.setData({
          feedbackList: remainingFeedback,
          allNotifications: this.mergeAndSortNotifications(notifications, remainingFeedback)
        });
        break;
    }
  },

  // 从服务器删除售后反馈
  async deleteFeedbackFromServer(feedbackIds) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'deleteFeedbackBatch',
        data: {
          ids: feedbackIds
        }
      });
      if (res.result.code !== 0) {
        console.error('删除售后反馈失败:', res.result.message);
      }
    } catch (error) {
      console.error('调用删除售后反馈接口失败:', error);
    }
  },

  // 逐条提醒操作
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
   * 一键删除所有通知（已废弃，使用 onDeleteAll 替代）
   */
  deleteAllNotifications() {
    // 此方法已废弃，删除逻辑已移至 onDeleteAll
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