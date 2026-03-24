Page({
  data: {
    total: '0.00'
  },

  onLoad(options) {
    if (options.total) {
      this.setData({
        total: options.total
      });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  pay() {
    wx.showToast({
      title: '支付成功',
      icon: 'success',
      duration: 2000,
      success: () => {
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      }
    });
  }
});