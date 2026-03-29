const app = getApp();

Page({
  data: {
    role: ''
  },
  async onShow() {
    const role = await app.getUserRole();
    this.setData({ role });
  },
  async switchToCustomer() {
    try {
      await app.switchRole('customer');
      wx.switchTab({ url: '/pages/customer/index/index' });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  },
  async switchToMerchant() {
    try {
      await app.switchRole('merchant');
      wx.reLaunch({ url: '/pages/merchant/index/index' });
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' });
    }
  }
});