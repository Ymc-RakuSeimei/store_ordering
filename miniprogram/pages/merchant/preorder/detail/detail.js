Page({
  data: {
    dragonId: '',
    dragon: null,
    participants: []
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '接龙详情' });
    if (options.id) {
      this.setData({ dragonId: options.id });
      this.loadDragonDetail();
    }
  },

  onBack() {
    wx.navigateBack();
  },

  // 加载接龙详情
  loadDragonDetail() {
    wx.showLoading({ title: '加载中...' });
    this.fetchDragonDetail(this.data.dragonId)
      .then(data => {
        wx.hideLoading();
        this.setData({
          dragon: data.dragon,
          participants: data.participants
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载详情失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  // 截止接龙
  onStopDragon() {
    wx.showModal({
      title: '确认截单',
      content: '截止后将无法继续参与接龙，确定要截止吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '截止中...' });
          this.stopPreorder(this.data.dragonId)
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: '已截止', icon: 'success' });
              // 刷新详情页
              this.loadDragonDetail();
            })
            .catch(err => {
              wx.hideLoading();
              console.error('截止失败', err);
              wx.showToast({ title: '截止失败', icon: 'none' });
            });
        }
      }
    });
  },

  // 导出表格
  onExport() {
    wx.showLoading({ title: '导出中...' });
    this.exportPreorder(this.data.dragonId)
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '导出成功', icon: 'success' });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('导出失败', err);
        wx.showToast({ title: '导出失败', icon: 'none' });
      });
  },

  // ---------------- 后端接口实现 ----------------

  /**
   * 获取接龙详情
   * @param {string} dragonId - 接龙ID
   * @returns {Promise<{dragon: object, participants: Array}>}
   * 后端实现步骤：
   * 1. 查询 preorder_dragons 表，获取接龙基本信息
   * 2. 查询 preorder_participants 表，按接龙ID筛选，获取参与用户列表
   * 3. 参与用户列表按参与时间倒序排列
   * 4. 返回数据
   * 接龙数据结构：
   * {
   *   id: String,
   *   img: String,
   *   name: String,
   *   spec: String,
   *   salePrice: Number,
   *   costPrice: Number,
   *   participantCount: Number,
   *   totalQty: Number,
   *   arrivalDate: String,
   *   status: 'ongoing' | 'completed'
   * }
   * 参与用户数据结构：
   * {
   *   userId: String,
   *   userName: String,
   *   avatarUrl: String,
   *   qty: Number,
   *   joinTime: String // 'YYYY-MM-DD HH:mm'
   * }
   */
  fetchDragonDetail(dragonId) {
    console.log('获取接龙详情', dragonId);
    // 本地占位数据
    return Promise.resolve({
      dragon: {
        id: dragonId,
        img: '/images/avatar.png',
        name: '派大星同款手套气球',
        spec: '50个/袋',
        salePrice: 29.9,
        costPrice: 15.0,
        participantCount: 12,
        totalQty: 48,
        arrivalDate: '2026-04-15',
        status: 'ongoing'
      },
      participants: [
        {
          userId: 'u001',
          userName: '派大星',
          avatarUrl: '/images/avatar.png',
          qty: 5,
          joinTime: '2026-03-28 10:30'
        },
        {
          userId: 'u002',
          userName: '海绵宝宝',
          avatarUrl: '/images/avatar.png',
          qty: 3,
          joinTime: '2026-03-28 11:15'
        }
      ]
    });
  },

  /**
   * 截止接龙
   * @param {string} dragonId - 接龙ID
   * @returns {Promise}
   * 后端实现步骤：
   * 1. 更新 preorder_dragons 表，status 改为 'completed'
   * 2. 如果有定时任务，取消该接龙的定时任务
   * 3. 可发送通知给已参与的用户
   */
  stopPreorder(dragonId) {
    console.log('截止接龙', dragonId);
    return Promise.resolve();
  },

  /**
   * 导出接龙表格
   * @param {string} dragonId - 接龙ID
   * @returns {Promise}
   * 后端实现步骤：
   * 1. 查询该接龙的参与用户列表
   * 2. 生成Excel或CSV表格
   * 3. 上传到云存储
   * 4. 返回下载链接，前端调用 wx.downloadFile 下载
   * 或直接在后端生成并发送给商家
   */
  exportPreorder(dragonId) {
    console.log('导出接龙表格', dragonId);
    return Promise.resolve();
  },

  /**
   * 转发接龙卡片
   */
  onShareAppMessage() {
    const dragon = this.data.dragon;
    if (!dragon) {
      return {};
    }
    return {
      title: `${dragon.name} - 接龙进行中`,
      path: `/pages/preorder/join/join?id=${this.data.dragonId}`,
      imageUrl: dragon.img || ''
    };
  },

  /**
   * 分享到朋友圈（可选）
   */
  onShareTimeline() {
    const dragon = this.data.dragon;
    if (!dragon) {
      return {};
    }
    return {
      title: `${dragon.name} - 快来参与接龙`,
      imageUrl: dragon.img || '',
      query: `id=${this.data.dragonId}`
    };
  }
});
