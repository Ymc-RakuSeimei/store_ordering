// pages/customer/index/index.js
Page({
  data: {
    userInfo: {
      nickName: '派大星',
      avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png'
    },
    unreadMessageCount: 0
  },

  onLoad(options) {
    console.log('首页加载')
    this.getUserInfo()
    this.getUnreadMessageCount()
  },

  onShow() {
    console.log('首页显示')
    this.getUserInfo()
    this.getUnreadMessageCount()
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

  // 获取未读消息数量
  async getUnreadMessageCount() {
    try {
      console.log('开始获取未读消息数量')
      // 获取用户openid
      const app = getApp()
      console.log('app.globalData.openid:', app.globalData.openid)
      const openid = app.globalData.openid || await app.getOpenId()
      console.log('获取到的openid:', openid)
      
      if (!openid) {
        console.log('没有openid，返回')
        return
      }
      
      // 使用云函数获取消息列表，然后统计未读数量
      const res = await wx.cloud.callFunction({
        name: 'getMessageList',
        data: {
          openid: openid,
          limit: 100,
          page: 0
        }
      })
      
      console.log('云函数返回结果:', res)
      
      if (res.result.code === 0) {
        // 统计未读消息数量
        const unreadCount = res.result.data.filter(item => !item.isRead).length
        console.log('未读消息数量:', unreadCount)
        
        this.setData({
          unreadMessageCount: unreadCount
        })
        console.log('设置未读消息数量:', unreadCount)
      }
    } catch (err) {
      console.error('获取未读消息数量失败', err)
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