const app = getApp();

Page({
  data: {
    dragonId: '',
    dragon: null,
    participants: [],
    loading: true,
    authLoading: false,
    submitLoading: false,
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
    this.authAndLoad();
  },

  async authAndLoad() {
    try {
      this.setData({ authLoading: true });

      const role = await app.getUserRole();
      if (role !== 'customer') {
        this.setData({ authLoading: false });
        wx.showModal({
          title: '提示',
          content: '请以顾客身份参与接龙',
          showCancel: false,
          success: () => wx.navigateBack()
        });
        return;
      }

      this.setData({ userInfo: app.globalData.userInfo, authLoading: false });
      this.loadDragonDetail();
    } catch (err) {
      this.setData({ authLoading: false });
      console.error('身份验证失败', err);
      wx.showToast({ title: '身份验证失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  loadDragonDetail() {
    this.setData({ loading: true });
    this.fetchDragonDetail(this.data.dragonId)
      .then(data => {
        const myParticipation = data.participants.find(
          p => p.userId === app.globalData.userInfo?._id
        );

        this.setData({
          dragon: data.dragon,
          participants: data.participants.slice(0, 10),
          loading: false,
          hasJoined: !!myParticipation,
          myParticipation: myParticipation || null
        });
      })
      .catch(err => {
        this.setData({ loading: false });
        console.error('加载详情失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  onDecreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  onIncreaseQty() {
    const { quantity, dragon } = this.data;
    if (dragon.limitPerPerson > 0 && quantity >= dragon.limitPerPerson) {
      wx.showToast({ title: `每人限购${dragon.limitPerPerson}件`, icon: 'none' });
      return;
    }
    this.setData({ quantity: quantity + 1 });
  },

  onQtyInput(e) {
    let qty = parseInt(e.detail.value) || 1;
    const { dragon } = this.data;
    if (dragon.limitPerPerson > 0 && qty > dragon.limitPerPerson) {
      qty = dragon.limitPerPerson;
      wx.showToast({ title: `每人限购${dragon.limitPerPerson}件`, icon: 'none' });
    }
    if (qty < 1) qty = 1;
    this.setData({ quantity: qty });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  onSubmit() {
    if (this.data.submitting) return;

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

  async doSubmit() {
    this.setData({ submitting: true, submitLoading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'joinPreorder',
        data: {
          dragonId: this.data.dragonId,
          quantity: this.data.quantity,
          remark: this.data.remark
        }
      });

      if (!res.result.success) {
        throw new Error(res.result.message || '参与失败');
      }

      this.setData({ submitting: false, submitLoading: false });
      wx.showToast({ title: '参与成功', icon: 'success' });

      setTimeout(() => {
        this.loadDragonDetail();
      }, 500);
    } catch (err) {
      this.setData({ submitting: false, submitLoading: false });
      console.error('提交失败', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  fetchDragonDetail(dragonId) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'fetchPreorderDetail',
        data: { dragonId },
        success(res) {
          const result = res.result;
          if (result.code !== 0) {
            return reject(new Error(result.message));
          }

          resolve({
            dragon: result.data.dragon,
            participants: result.data.participants || []
          });
        },
        fail(err) {
          reject(new Error('网络请求失败'));
        }
      });
    });
  }
});
