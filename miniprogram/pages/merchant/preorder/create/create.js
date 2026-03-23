Page({
  data: {
    form: {
      name: '',
      description: '',
      spec: '',
      salePrice: '',
      costPrice: '',
      closeType: 'manual',
      closeTypeLabels: [
        { value: 'manual', label: '手动截单' },
        { value: 'timed', label: '定时截单' }
      ]
    }
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '创建接龙' });
  },

  onBack() {
    wx.navigateBack();
  },

  // 输入框数据双向绑定
  onInputChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({ [`form.${key}`]: value });
  },

  // 截单方式选择
  onCloseTypeChange(e) {
    this.setData({ 'form.closeType': e.detail.value });
  },

  // 生成卡片并转发（调用后端接口占位）
  onGenerateAndShare() {
    const payload = this.data.form;

    // 这里可以加表单校验
    if (!payload.name || !payload.salePrice || !payload.costPrice) {
      wx.showToast({ title: '请完善商品信息', icon: 'none' });
      return;
    }

    this.createPreorder(payload)
      .then(() => {
        wx.showToast({ title: '已创建接龙，准备转发', icon: 'success' });
        wx.navigateBack();
      })
      .catch(err => {
        console.error('createPreorder error', err);
        wx.showToast({ title: '创建失败', icon: 'none' });
      });
  },

  // 取消，直接返回上一页
  onCancel() {
    wx.navigateBack();
  },

  // ---------------- 后端接口占位 ----------------

  /**
   * 创建接龙并返回卡片数据或者分享链接
   * 后端实现示例：wx.cloud.callFunction({ name: 'createPreorderDragon', data: payload })
   */
  createPreorder(payload) {
    console.log('调用后端 createPreorder', payload);
    return Promise.resolve();
  }
});