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

  // 进入接龙详情页面
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/merchant/preorder/detail/detail?id=${id}` });
  },

  // 一键统计：调用后端汇总正在/已截单数据
  onOneKeyStatistics() {
    wx.showLoading({ title: '统计中...' });
    this.pushPreorderStatistics()
      .then(stats => {
        wx.hideLoading();
        // 显示统计结果，可弹窗或页面展示
        wx.showModal({
          title: '统计结果',
          content: `正在接龙：${stats.currentCount}个\n已截单：${stats.completedCount}个\n总参与人数：${stats.totalParticipants}\n总预订件数：${stats.totalQty}`,
          showCancel: false
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('onOneKeyStatistics error', err);
        wx.showToast({ title: '统计失败', icon: 'none' });
      });
  },

  // 统计单个接龙
  onHandleCurrent(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '统计中...' });
    this.statSinglePreorder(id)
      .then(stats => {
        wx.hideLoading();
        wx.showModal({
          title: '接龙统计',
          content: `参与人数：${stats.participantCount}\n总预订件数：${stats.totalQty}`,
          showCancel: false
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('statSinglePreorder error', err);
        wx.showToast({ title: '统计失败', icon: 'none' });
      });
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
   * 后端实现步骤：
   * 1. 验证商家身份
   * 2. 查询 preorder_dragons 表，按商家ID筛选
   * 3. 按 status 分为两组：ongoing（正在接龙）和 completed（已截单）
   * 4. 每组按创建时间倒序排列
   * 5. 返回数据
   * 每个接龙的数据结构：
   * {
   *   id: String,
   *   img: String, // 商品图片URL
   *   name: String,
   *   spec: String,
   *   participantCount: Number, // 参与人数
   *   totalQty: Number, // 总预订件数
   *   arrivalDate: String, // 预计到货日期
   *   status: String
   * }
   */
  fetchPreorderListFromServer() {
    // 本地占位数据，后端替换即可
    return Promise.resolve({
      current: [
        {
          id: '1',
          img: '/images/avatar.png',//照片从数据库拉取
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
   * 一键统计接口
   * @returns {Promise<{currentCount: Number, completedCount: Number, totalParticipants: Number, totalQty: Number}>}
   * 后端实现步骤：
   * 1. 统计该商家正在接龙的数量
   * 2. 统计该商家已截单的数量
   * 3. 统计总参与人数（所有接龙）
   * 4. 统计总预订件数（所有接龙）
   * 5. 返回统计结果
   */
  pushPreorderStatistics() {
    return Promise.resolve({
      currentCount: 1,
      completedCount: 1,
      totalParticipants: 20,
      totalQty: 68
    });
  },

  /**
   * 统计单个接龙
   * @param {string} id - 接龙ID
   * @returns {Promise<{participantCount: Number, totalQty: Number, participants: Array}>}
   * 后端实现步骤：
   * 1. 查询 preorder_participants 表，按接龙ID筛选
   * 2. 统计参与人数（去重用户数）
   * 3. 统计总预订件数
   * 4. 可返回参与用户列表供详情页展示
   */
  statSinglePreorder(id) {
    console.log('统计单个接龙', id);
    return Promise.resolve({
      participantCount: 12,
      totalQty: 48
    });
  },

  /**
   * 截止单个接龙
   * @param {string} id - 接龙ID
   * @returns {Promise}
   * 后端实现步骤：
   * 1. 更新 preorder_dragons 表，status 改为 'completed'
   * 2. 如果有定时任务，取消该接龙的定时任务
   * 3. 可发送通知给已参与的用户
   */
  stopPreorder(id) {
    console.log('截止接龙', id);
    return Promise.resolve();
  }
});
