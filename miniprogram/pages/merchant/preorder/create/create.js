Page({
  data: {
    today: '',
    form: {
      img: '',
      name: '',
      description: '',
      spec: '',
      salePrice: '',
      costPrice: '',
      stock: '',
      limitPerPerson: 10,
      arrivalDate: '',
      closeType: 'manual',
      closeTypeIndex: 0,
      closeTypeLabels: [
        { value: 'manual', label: '手动截单' },
        { value: 'timed', label: '定时截单' }
      ],
      closeTime: [0, 0],
      closeTimeStr: ''
    },
    // 时间选择器使用小时 / 分钟两列。
    timeRange: [
      Array.from({ length: 24 }, (_, i) => i),
      Array.from({ length: 60 }, (_, i) => i)
    ]
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '创建接龙' });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({ today: todayStr });
  },

  onBack() {
    wx.navigateBack();
  },

  // 选择商品图片。
  chooseProductImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ 'form.img': tempFilePath });
      }
    });
  },

  // 表单输入的通用更新方法。
  onInputChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({ [`form.${key}`]: value });
  },

  onArrivalDateChange(e) {
    this.setData({ 'form.arrivalDate': e.detail.value });
  },

  onCloseTypeChange(e) {
    const index = Number(e.detail.value);
    const closeType = this.data.form.closeTypeLabels[index].value;

    this.setData({
      'form.closeTypeIndex': index,
      'form.closeType': closeType
    });
  },

  onCloseTimeChange(e) {
    const [hourIndex, minuteIndex] = e.detail.value;
    const hour = this.data.timeRange[0][hourIndex];
    const minute = this.data.timeRange[1][minuteIndex];
    const closeTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    this.setData({
      'form.closeTime': [hourIndex, minuteIndex],
      'form.closeTimeStr': closeTimeStr
    });
  },

  // 创建接龙商品。
  // 当前阶段直接写入 goods 集合，不再单独维护 preorder_dragons 集合。
  onCreatePreorder() {
    const payload = { ...this.data.form };
    const salePrice = Number(payload.salePrice);
    const costPrice = Number(payload.costPrice);
    const limitPerPerson = Number(payload.limitPerPerson);

    if (!payload.img) {
      wx.showToast({ title: '请上传商品图片', icon: 'none' });
      return;
    }

    if (!payload.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }

    if (!payload.spec) {
      wx.showToast({ title: '请输入商品规格', icon: 'none' });
      return;
    }

    if (Number.isNaN(salePrice) || salePrice < 0 || Number.isNaN(costPrice) || costPrice < 0) {
      wx.showToast({ title: '请输入正确的售价和进价', icon: 'none' });
      return;
    }

    if (!Number.isInteger(limitPerPerson) || limitPerPerson <= 0) {
      wx.showToast({ title: '每人限购必须为正整数', icon: 'none' });
      return;
    }

    if (!payload.arrivalDate) {
      wx.showToast({ title: '请选择预计到货时间', icon: 'none' });
      return;
    }

    if (payload.closeType === 'timed' && !payload.closeTimeStr) {
      wx.showToast({ title: '请选择截单时间', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });

    this.uploadProductImage(payload.img)
      .then((fileID) => {
        payload.img = fileID;
        return this.createPreorderToServer(payload);
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '创建成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1200);
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('创建接龙失败', err);
        wx.showToast({ title: err.message || '创建失败，请重试', icon: 'none' });
      });
  },

  onCancel() {
    wx.navigateBack();
  },

  // 上传接龙商品图片到云存储。
  uploadProductImage(tempFilePath) {
    if (String(tempFilePath || '').startsWith('cloud://')) {
      return Promise.resolve(tempFilePath);
    }

    return wx.cloud.uploadFile({
      cloudPath: `preorder_goods/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`,
      filePath: tempFilePath
    }).then((res) => res.fileID);
  },

  // 调用云函数创建接龙商品。
  createPreorderToServer(payload) {
    return wx.cloud.callFunction({
      name: 'createPreorderGoods',
      data: payload
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '创建接龙失败');
      }
      return result.data || null;
    });
  }
});
