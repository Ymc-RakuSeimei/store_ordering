Page({
  data: {
    currentDragons: [], // 正在接龙列表
    completedDragons: [], // 已截单列表
    loading: true
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '预售订货' });
    this.loadPreorderList();
  },

  onShow() {
    // 每次页面显示时刷新数据
    this.loadPreorderList();
  },

  // 拉取预售接龙列表，含正在接龙 + 已截单
  loadPreorderList() {
    this.setData({ loading: true });
    this.fetchPreorderListFromServer()
      .then(res => {
        this.setData({
          currentDragons: res.current || [],
          completedDragons: res.completed || [],
          loading: false
        });
      })
      .catch(err => {
        console.error('loadPreorderList error', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  // 进入创建接龙页面
  toCreatePreorder() {
    wx.navigateTo({ url: '/pages/merchant/preorder/create/create' });
  },

  // 转发接龙卡片
  onShareAppMessage(e) {
    const item = e.target.dataset.item || {};
    if (!item.id) {
      return {};
    }
    return {
      title: `${item.name} - 接龙进行中`,
      path: `/pages/preorder/join/join?id=${item.id}`,
      imageUrl: item.img || ''
    };
  },

  // 分享到朋友圈（可选）
  onShareTimeline() {
    // 这里可以返回默认分享，或者针对当前页面设置分享内容
    return {
      title: '快来参与接龙',
      query: ''
    };
  },

  // 截止单个接龙
  onStopCurrent(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认截单',
      content: '截止后将无法继续参与接龙，确定要截止吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '截止中...' });
          this.stopPreorder(id)
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '已截止', icon: 'success' });
              this.loadPreorderList();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('stopPreorder error', err);
              wx.showToast({ title: '截止失败', icon: 'none' });
            });
        }
      }
    });
  },

  // ---------------- 后端接口实现 ----------------

  /**
   * 拉取预售接龙列表
   * @returns {Promise<{current: Array, completed: Array}>}
   */
  fetchPreorderListFromServer() {
    // 本地占位数据，后端替换即可
    return Promise.resolve({
      current: [
        {
          id: '1',
          img: '/images/avatar.png',
          name: '派大星同款手套气球',
          spec: '50个/袋',
          participantCount: 12,
          totalQty: 48,
          arrivalDate: '2026-04-15',
          status: 'ongoing'
        }
      ],
      completed: [
        {
          id: '2',
          img: '/images/avatar.png',
          name: '海绵宝宝同款领带',
          spec: '1条',
          participantCount: 8,
          totalQty: 20,
          arrivalDate: '2026-04-10',
          status: 'completed'
        }
      ]
    });
  },

  /**
   * 截止单个接龙
   * @param {string} id - 接龙ID
   * @returns {Promise}
   */
  stopPreorder(id) {
    console.log('截止接龙', id);
    return Promise.resolve();
  }
});
