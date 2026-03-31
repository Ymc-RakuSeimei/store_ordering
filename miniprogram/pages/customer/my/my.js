// pages/customer/my/my.js
Page({
  data: {
    userInfo: {
      nickName: '游客',
      avatarUrl: '/images/avatar.png',
      phoneNumber: '',
      role: ''
    },
    notificationEnabled: true
  },

  onLoad(options) {
    this.checkLoginStatus()
  },

  onShow() {
    this.checkLoginStatus()
  },

  // 检查登录状态
  async checkLoginStatus() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      })
      console.log('getUserInfo 返回结果:', res)
      
      if (res.result.success && res.result.user) {
        console.log('用户数据:', res.result.user)
        this.setData({
          userInfo: {
            nickName: res.result.user.nickName || '微信用户',
            avatarUrl: res.result.user.avatarUrl || '/images/avatar.png',
            phoneNumber: res.result.user.phoneNumber || '',
            role: res.result.user.role || 'customer',
            openid: res.result.user.openid
          }
        })
      } else {
        console.log('用户未登录或不存在')
        this.setData({
          userInfo: {
            nickName: '游客',
            avatarUrl: '/images/avatar.png',
            phoneNumber: '',
            role: ''
          }
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    } finally {
      wx.hideLoading()
    }
  },

  // 登录（直接保存微信返回的头像URL）
  async handleLogin() {
    if (this.data.userInfo.openid) {
      console.log('已登录，无需重复授权')
      return
    }

    wx.showLoading({ title: '获取中...' })
    try {
      // 1. 获取微信用户信息
      const { userInfo } = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: resolve,
          fail: reject
        })
      })
      console.log('获取到的微信用户信息:', userInfo)

      // 2. 直接保存微信返回的头像URL（不上传到云存储）
      const saveRes = await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl  // 直接保存微信头像URL
        }
      })
      console.log('保存结果:', saveRes)

      if (saveRes.result.success) {
        await this.checkLoginStatus()
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })
      } else {
        throw new Error('保存失败')
      }
    } catch (err) {
      console.error('登录失败', err)
      if (err.errMsg && err.errMsg.includes('deny')) {
        wx.showToast({
          title: '需要授权才能登录',
          icon: 'none'
        })
      } else {
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        })
      }
    } finally {
      wx.hideLoading()
    }
  },

  // 跳转订单中心
  goToOrderCenter() {
    wx.navigateTo({ url: '/pages/customer/myOrder/myOrder' })
  },

  // 消息订阅通知
  toggleNotification() {
    wx.showModal({
      title: '消息订阅',
      content: '开启后不错过新品与到货通知',
      success(res) {
        if (res.confirm) {
          wx.showToast({ title: '已开启', icon: 'success' })
        }
      }
    })
  },

  // 联系售后/商家
  contactService() {
    wx.showActionSheet({
      itemList: ['联系电话', '意见反馈'],
      success(res) {
        if (res.tapIndex === 0) {
          wx.makePhoneCall({ phoneNumber: '400-123-4567' })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/customer/feedback/feedback' })
        }
      }
    })
  }
})