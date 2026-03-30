// pages/preorder/join/join.js
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
    error: ''
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '参与接龙' });

    if (!options.id) {
      this.setData({ error: '链接无效', loading: false });
      return;
    }

    this.setData({ dragonId: options.id });
    this.authAndLoad();
  },

  /**
   * 身份验证并加载数据
   */
  async authAndLoad() {
    try {
      wx.showLoading({ title: '验证中...' });

      // 获取用户身份（如果未注册会自动注册）
      await app.getUserRole();

      wx.hideLoading();
      this.loadDragonDetail();
    } catch (err) {
      wx.hideLoading();
      console.error('身份验证失败', err);
      this.setData({ error: '身份验证失败，请重试', loading: false });
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
          p => p.userId === app.globalData.userInfo?.openid || p.userId === app.globalData.userInfo?._id
        );

        this.setData({
          dragon: data.dragon,
          participants: data.participants,
          loading: false,
          hasJoined: !!myParticipation,
          myParticipation: myParticipation || null
        });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载详情失败', err);
        this.setData({ error: '加载失败，请重试', loading: false });
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
  onSubmit() {
    if (this.data.submitting) return;
    if (this.data.quantity < 1) {
      wx.showToast({ title: '请填写数量', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认参与',
      content: `参与 "${this.data.dragon.name}"\n数量：${this.data.quantity} 份`,
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
          participantCount: 12,
          totalQty: 48,
          status: 'ongoing'
        },
        participants: []
      });
    });
  },

  /**
   * 提交接龙参与
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
