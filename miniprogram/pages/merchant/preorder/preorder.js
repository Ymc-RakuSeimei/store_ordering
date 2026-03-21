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

  onBack() {
    wx.navigateBack();
  },

  // 拉取预售接龙数据，含正在接龙 + 已截单
  loadPreorderList() {
    this.setData({ loading: true });
    this.fetchPreorderListFromServer()
      .then(res => {
        // 预期后端返回 { current: [], completed: [] }
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

  // 一键统计：调用后端汇总正在/已截单数据（不建议前端处理）
  onOneKeyStatistics() {
    this.pushPreorderStatistics()
      .then(() => {
        wx.showToast({ title: '统计完成', icon: 'success' });
        this.loadPreorderList();
      })
      .catch(err => {
        console.error('onOneKeyStatistics error', err);
        wx.showToast({ title: '统计失败', icon: 'none' });
      });
  },

  // 统计单个接龙（占位）
  onHandleCurrent(e) {
    const id = e.currentTarget.dataset.id;
    // 后端需处理该操作，例如 wx.cloud.callFunction({name:'statSinglePreorder', data:{id}})
    wx.showToast({ title: `统计 ${id}`, icon: 'none' });
  },

  // 截止单个接龙（占位）
  onStopCurrent(e) {
    const id = e.currentTarget.dataset.id;
    // 后端需处理该操作，例如 wx.cloud.callFunction({name:'stopPreorder', data:{id}})
    wx.showToast({ title: `已截止 ${id}`, icon: 'success' });
    this.loadPreorderList();
  },

  // ---------------- 后端接口占位 ----------------

  /**
   * 拉取预售接龙列表（正在接龙/已截单）
   * 后端实现，例如：wx.cloud.callFunction({ name: 'getPreorderList' })
   * 返回 Promise.resolve({ current: [], completed: [] })
   */
  fetchPreorderListFromServer() {
    // 下面为本地占位数据，后端替换即可
    return Promise.resolve({
      current: [
        { id: '1', name: '派大星同款手套气球', spec: '50个/袋', qty: 20 }
      ],
      completed: [
        { id: '2', name: '海绵宝宝同款领带', spec: '1条', qty: 20 }
      ]
    });
  },

  /**
   * 一键统计接口（数据汇总）
   * 后端实现，例如：wx.cloud.callFunction({ name: 'getPreorderStats' })
   */
  pushPreorderStatistics() {
    // TODO：根据后端设计替换接口
    return Promise.resolve();
  }
});