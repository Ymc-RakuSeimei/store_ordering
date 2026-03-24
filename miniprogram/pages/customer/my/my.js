// pages/customer/my/my.js
Page({
  data: {

  },

  onLoad(options) {

  },

  onReady() {

  },

  onShow() {

  },

  onHide() {

  },

  onUnload() {

  },

  onPullDownRefresh() {

  },

  onReachBottom() {

  },

  onShareAppMessage() {

  },

  // 跳转订单中心
  goToOrderCenter() {
    wx.navigateTo({
      url: '/pages/customer/myOrder/myOrder'
    });
  },

  // 消息订阅通知
  toggleNotification() {
    wx.showModal({
      title: '消息订阅',
      content: '开启后不错过新品与到货通知',
      success(res) {
        if (res.confirm) {
          wx.showToast({
            title: '已开启',
            icon: 'success'
          });
        }
      }
    });
  },

  // 联系售后/商家
  contactService() {
    wx.showActionSheet({
      itemList: ['联系电话', '意见反馈'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({
            phoneNumber: '400-123-4567'
          });
        } else if (res.tapIndex === 1) {
          wx.navigateTo({
            url: '/pages/customer/feedback/feedback'
          });
        }
      }
    });
  }
})