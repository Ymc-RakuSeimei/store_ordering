// pages/customer/index/index.js
Page({
  data: {
    userInfo: {
      nickName: '派大星',
      avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
    }
  },

  onLoad(options) {
    this.getUserInfo()
  },

  onShow() {
    this.getUserInfo()
  },

  // 获取当前登录用户信息
  async getUserInfo() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      })
      if (res.result.success && res.result.user) {
        this.setData({
          userInfo: {
            nickName: res.result.user.nickName || '派大星',
            avatarUrl: res.result.user.avatarUrl || 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
          }
        })
      } else {
        // 未登录，保持默认
        this.setData({
          userInfo: {
            nickName: '派大星',
            avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
          }
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
      this.setData({
        userInfo: {
          nickName: '派大星',
          avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
        }
      })
    }
  },

  goToNewGoods() {
    wx.navigateTo({ url: '/pages/customer/goods/newgoods/newgoods' })
  },

  goToShopList() {
    wx.switchTab({ url: '/pages/customer/goods/goods' })
  },

  goToMyOrder() {
    wx.navigateTo({ url: '/pages/customer/myOrder/myOrder' })
  },

  // 扫码取货 - 跳转到我的订单页面，并选中"待取货"Tab
  goToFeedback() {
    wx.navigateTo({
      url: '/pages/customer/myOrder/myOrder?tab=waiting'
    })
  },

  goToMessage() {
    wx.navigateTo({ url: '/pages/customer/message/message' })
  }
})