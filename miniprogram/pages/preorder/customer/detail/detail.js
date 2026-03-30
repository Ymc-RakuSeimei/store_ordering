// pages/customer/preorder/detail/detail.js
const app = getApp();

Page({
  data: {
    dragonId: '',
    dragon: null,
    participants: [],
    loading: true,
    submitting: false,
    quantity: 1,
    remark: '',
    hasJoined: false,
    myParticipation: null,
    userInfo: null
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '接龙详情' });

    if (!options.id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ dragonId: options.id });

    // 先验证身份，再加载数据
    this.authAndLoad();
  },

  /**
   * 身份验证并加载数据
   */
  async authAndLoad() {
    try {
      wx.showLoading({ title: '验证中...' });

      // 验证用户身份
      const role = await app.getUserRole();
      if (role !== 'customer') {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '请以顾客身份参与接龙',
          showCancel: false,
          success: () => wx.navigateBack()
        });
        return;
      }

      // 获取用户信息
      this.setData({ userInfo: app.globalData.userInfo });
      wx.hideLoading();

      // 加载接龙数据
      this.loadDragonDetail();
    } catch (err) {
      wx.hideLoading();
      console.error('身份验证失败', err);
      wx.showToast({ title: '身份验证失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  /**
   * 加载接龙详情
   */
  loadDragonDetail() {
    wx.showLoading({ title: '加载中...' });
    this.fetchDragonDetail(this.data.dragonId)
      .then(data => {
        wx.hideLoading();

        // 检查当前用户是否已参与
        const myParticipation = data.participants.find(
          p => p.userId === app.globalData.userInfo?._id
        );

        this.setData({
          dragon: data.dragon,
          participants: data.participants.slice(0, 10), // 只显示最新10条
          loading: false,
          hasJoined: !!myParticipation,
          myParticipation: myParticipation || null
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载详情失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  /**
   * 减少数量
   */
  onDecreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  /**
   * 增加数量
   */
  onIncreaseQty() {
    this.setData({ quantity: this.data.quantity + 1 });
  },

  /**
   * 手动输入数量
   */
  onQtyInput(e) {
    let qty = parseInt(e.detail.value) || 1;
    if (qty < 1) qty = 1;
    this.setData({ quantity: qty });
  },

  /**
   * 输入备注
   */
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  /**
   * 提交参与
   */
  async onSubmit() {
    if (this.data.submitting) return;
    if (this.data.quantity < 1) {
      wx.showToast({ title: '请填写数量', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认参与',
      content: `确定要参与 "${this.data.dragon.name}" 吗？\n数量：${this.data.quantity} 份`,
      success: (res) => {
        if (res.confirm) {
          this.doSubmit();
        }
      }
    });
  },

  /**
   * 执行提交
   */
  async doSubmit() {
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      await this.submitPreorder({
        dragonId: this.data.dragonId,
        quantity: this.data.quantity,
        remark: this.data.remark
      });

      wx.hideLoading();
      this.setData({ submitting: false });

      wx.showToast({ title: '参与成功', icon: 'success' });

      // 重新加载数据，刷新状态
      setTimeout(() => {
        this.loadDragonDetail();
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('提交失败', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  // ---------------- 后端接口 ----------------

  /**
   * 获取接龙详情
   * @param {string} dragonId - 接龙ID
   * @returns {Promise<{dragon: object, participants: Array}>}
   */
  fetchDragonDetail(dragonId) {
    return wx.cloud.callFunction({
      name: 'fetchPreorderDetail',
      data: { dragonId }
    }).then(res => {
      if (res.result.code === 0) {
        return res.result.data;
      }
      throw new Error(res.result.message || '获取详情失败');
    }).catch(err => {
      // 开发阶段使用本地占位数据
      console.log('使用本地占位数据');
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
    });
  },

  /**
   * 提交接龙参与
   * @param {object} data - 参与数据
   * @param {string} data.dragonId - 接龙ID
   * @param {number} data.quantity - 数量
   * @param {string} data.remark - 备注
   * @returns {Promise}
   */
  submitPreorder(data) {
    return wx.cloud.callFunction({
      name: 'submitPreorder',
      data: data
    }).then(res => {
      if (res.result.code === 0) {
        return res.result.data;
      }
      throw new Error(res.result.message || '提交失败');
    });
  }
});
