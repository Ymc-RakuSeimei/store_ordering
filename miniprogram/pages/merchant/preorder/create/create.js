Page({
  data: {
    today: '',
    loading: false,
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
      closeTime: [0, 0, 0],
      closeTimeStr: ''
    },
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

  onInputChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({ [`form.${key}`]: value });
  },

  onArrivalDateChange(e) {
    this.setData({ 'form.arrivalDate': e.detail.value });
  },

  onCloseTypeChange(e) {
    const index = e.detail.value;
    const closeType = this.data.form.closeTypeLabels[index].value;
    this.setData({
      'form.closeTypeIndex': index,
      'form.closeType': closeType
    });
  },

  onCloseTimeChange(e) {
    const [hour, minute] = e.detail.value;
    const closeTimeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    this.setData({
      'form.closeTime': [hour, minute],
      'form.closeTimeStr': closeTimeStr
    });
  },

  onCreatePreorder() {
    const payload = { ...this.data.form };

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

    this.setData({ loading: true });

    this.uploadProductImage(payload.img)
      .then(imgUrl => {
        payload.img = imgUrl;
        return this.createPreorderToServer(payload);
      })
      .then(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '创建成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      })
      .catch(err => {
        this.setData({ loading: false });
        console.error('创建接龙失败', err);
        wx.showToast({ title: '创建失败，请重试', icon: 'none' });
      });
  },

  onCancel() {
    wx.navigateBack();
  },

  uploadProductImage(tempFilePath) {
    const ext = tempFilePath.split('.').pop() || 'png';
    const cloudPath = `preorder/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

    return wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath
    }).then(res => res.fileID);
  },

  createPreorderToServer(payload) {
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
