Page({
  data: {
    currentDragons: [],
    completedDragons: [],
    loading: true
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '预售订货' });
    this.loadPreorderList();
  },

  onShow() {
    this.loadPreorderList();
  },

  // 拉取"正在接龙 / 已截单"两组数据。
  loadPreorderList() {
    this.setData({ loading: true });

    this.fetchPreorderListFromServer()
      .then((res) => {
        this.setData({
          currentDragons: res.current || [],
          completedDragons: res.completed || [],
          loading: false
        });
      })
      .catch((err) => {
        console.error('loadPreorderList error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  toCreatePreorder() {
    wx.navigateTo({ url: '/pages/merchant/preorder/create/create' });
  },

  onViewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/merchant/preorder/detail/detail?id=${id}`
    });
  },

  stopPropagation() {
    // 阻止事件冒泡，让按钮点击不触发卡片点击
  },

  // 商家转发接龙商品时，先直接把顾客引导到买家端"预定"tab。
  // 这样不需要继续依赖旧的 preorder_dragons 页面结构。
  onShareAppMessage(e) {
    const item = e.target.dataset.item || {};
    return {
      title: `${item.name || '接龙商品'} - 预定进行中`,
      path: `/pages/customer/goods/goods?tab=preorder&goodsId=${item.goodsId || item.id || ''}`,
      imageUrl: item.img || ''
    };
  },

  onShareTimeline() {
    return {
      title: '快来参与接龙',
      query: ''
    };
  },

  onStopCurrent(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认截单',
      content: '截止后将无法继续参与接龙，确定要截止吗？',
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '截止中...' });

        this.stopPreorder(id)
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已截止', icon: 'success' });
            this.loadPreorderList();
          })
          .catch((err) => {
            wx.hideLoading();
            console.error('stopPreorder error', err);
            wx.showToast({ title: err.message || '截止失败', icon: 'none' });
          });
      }
    });
  },

  onMarkArrival(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认到货',
      content: '确认商品已到货吗？',
      success: (res) => {
        if (!res.confirm) return;

        wx.showLoading({ title: '更新中...' });

        this.markArrival(id)
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: '已标记到货', icon: 'success' });
            this.loadPreorderList();
          })
          .catch((err) => {
            wx.hideLoading();
            console.error('markArrival error', err);
            wx.showToast({ title: err.message || '标记失败', icon: 'none' });
          });
      }
    });
  },

  // 获取商家端接龙列表。
  fetchPreorderListFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchPreorderList',
      data: {}
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取接龙列表失败');
      }
      return result.data || { current: [], completed: [] };
    });
  },

  // 截单。
  stopPreorder(id) {
    return wx.cloud.callFunction({
      name: 'stopPreorder',
      data: { id }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '截止失败');
      }
      return result.data || null;
    });
  },

  // 标记到货。
  markArrival(id) {
    return wx.cloud.callFunction({
      name: 'markArrival',
      data: { id }
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '标记失败');
      }
      return result.data || null;
    });
  }
});
