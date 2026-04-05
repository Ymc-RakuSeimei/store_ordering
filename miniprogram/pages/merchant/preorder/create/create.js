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
      limitPerPerson: 10, // 默认每人限购10件
      arrivalDate: '',
      closeType: 'manual',
      closeTypeIndex: 0,
      closeTypeLabels: [
        { value: 'manual', label: '手动截单' },
        { value: 'timed', label: '定时截单' }
      ],
      closeTime: [0, 0, 0], // [hour, minute]
      closeTimeStr: ''
    },
    // 时间选择器的范围（小时、分钟）
    timeRange: [
      Array.from({ length: 24 }, (_, i) => i),
      Array.from({ length: 60 }, (_, i) => i)
    ]
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '创建接龙' });
    // 设置今天的日期作为默认可选开始日期
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({ today: todayStr });
  },

  onBack() {
    wx.navigateBack();
  },

  // 选择商品图片
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

  // 输入框数据双向绑定
  onInputChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({ [`form.${key}`]: value });
  },

  // 选择预计到货日期
  onArrivalDateChange(e) {
    this.setData({ 'form.arrivalDate': e.detail.value });
  },

  // 截单方式选择
  onCloseTypeChange(e) {
    const index = e.detail.value;
    const closeType = this.data.form.closeTypeLabels[index].value;
    this.setData({
      'form.closeTypeIndex': index,
      'form.closeType': closeType
    });
  },

  // 定时截单时间选择
  onCloseTimeChange(e) {
    const [hour, minute] = e.detail.value;
    const closeTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    this.setData({
      'form.closeTime': [hour, minute],
      'form.closeTimeStr': closeTimeStr
    });
  },

  // 创建接龙（不通过转发，直接在小程序内创建）
  onCreatePreorder() {
    const payload = { ...this.data.form };

    // 表单校验
    if (!payload.img) {
      wx.showToast({ title: '请上传商品图片', icon: 'none' });
      return;
    }
    if (!payload.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' });
      return;
    }
    if (!payload.salePrice || !payload.costPrice) {
      wx.showToast({ title: '请输入售价和进价', icon: 'none' });
      return;
    }
    if (!payload.arrivalDate) {
      wx.showToast({ title: '请选择预计到货时间', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '创建中...' });

    // 1. 如果有图片，先上传图片到服务器
    this.uploadProductImage(payload.img)
      .then(imgUrl => {
        payload.img = imgUrl; // 替换为服务器返回的图片URL
        // 2. 创建接龙
        return this.createPreorderToServer(payload);
      })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: '创建成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      })
      .catch(err => {
        wx.hideLoading();
        console.error('创建接龙失败', err);
        wx.showToast({ title: '创建失败，请重试', icon: 'none' });
      });
  },

  // 取消，直接返回上一页
  onCancel() {
    wx.navigateBack();
  },

  // ---------------- 后端接口实现 ----------------

  /**
   * 上传商品图片到云存储
   * @param {string} tempFilePath - 临时图片路径
   * @returns {Promise<string>} 返回图片的永久访问URL
   */
  uploadProductImage(tempFilePath) {
    console.log('上传商品图片', tempFilePath);
    const ext = tempFilePath.split('.').pop() || 'png';
    const cloudPath = `preorder/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

    return wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath
    }).then(res => res.fileID);
  },

  /**
   * 创建接龙到数据库
   * @param {object} payload - 接龙数据
   * @returns {Promise} 创建成功后的Promise
   */
  createPreorderToServer(payload) {
    console.log('调用后端创建接龙', payload);
    return wx.cloud.callFunction({
      name: 'createPreorderGoods',
      data: {
        name: payload.name,
        description: payload.description,
        spec: payload.spec,
        salePrice: Number(payload.salePrice),
        costPrice: Number(payload.costPrice),
        limitPerPerson: Number(payload.limitPerPerson) || 10,
        arrivalDate: payload.arrivalDate,
        closeType: payload.closeType,
        closeTimeStr: payload.closeTimeStr,
        img: payload.img
      }
    }).then(res => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '创建接龙失败');
      }
      return result.data;
    });
  }
});
