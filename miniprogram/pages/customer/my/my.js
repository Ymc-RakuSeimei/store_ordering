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
  async contactService() {
    console.log('contactService函数被调用')
    const that = this
    wx.showActionSheet({
      itemList: ['联系商家', '售后反馈'],
      success: async (res) => {
        console.log('选择了选项:', res.tapIndex)
        if (res.tapIndex === 0) {
          console.log('开始联系商家流程')
          wx.showLoading({ title: '获取商家微信...' })
          try {
            console.log('用户信息:', that.data.userInfo)
            
            // 1. 获取当前用户的订单列表
            console.log('开始调用getOrderList')
            const orderRes = await wx.cloud.callFunction({
              name: 'getOrderList',
              data: {
                openid: that.data.userInfo.openid
              }
            })
            console.log('getOrderList返回结果:', orderRes)
            
            if (!orderRes.result || orderRes.result.code !== 0 || !orderRes.result.data || orderRes.result.data.length === 0) {
              wx.hideLoading()
              wx.showToast({ title: '暂无订单信息', icon: 'none' })
              return
            }
            
            // 2. 从订单中获取店名（取第一个订单的store字段）
            const firstOrder = orderRes.result.data[0]
            const storeName = firstOrder.store || 'MC_store' // 默认店名
            console.log('店名:', storeName)
            
            // 3. 调用云函数获取对应商家信息
            console.log('开始调用getUserInfo获取商家')
            const merchantRes = await wx.cloud.callFunction({
              name: 'getUserInfo',
              data: { role: 'merchant', store: storeName }
            })
            console.log('getUserInfo返回结果:', merchantRes)
            
            wx.hideLoading()
            
            // 直接显示弹窗
            console.log('准备显示弹窗')
            if (merchantRes.result && merchantRes.result.success && merchantRes.result.user) {
              const merchantUser = merchantRes.result.user
              const wechat = merchantUser.wechat || 'wechat_ymc123456'
              console.log('商家微信:', wechat)
              
              wx.showModal({
                title: `${storeName} 商家微信`,
                content: `商家微信号：${wechat}\n\n请复制微信号添加商家`,
                showCancel: false,
                confirmText: '确定',
                success: (modalRes) => {
                  console.log('弹窗确认被点击')
                  if (modalRes.confirm) {
                    wx.setClipboardData({
                      data: wechat,
                      success: () => {
                        wx.showToast({ title: '微信号已复制', icon: 'success' })
                      }
                    })
                  }
                },
                fail: (err) => {
                  console.log('弹窗失败:', err)
                }
              })
              console.log('wx.showModal已调用')
            } else {
              wx.showToast({ title: '暂未获取到商家微信', icon: 'none' })
            }
          } catch (err) {
            wx.hideLoading()
            console.error('获取商家微信失败', err)
            wx.showToast({ title: '获取失败，请重试', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          // 售后反馈
          wx.navigateTo({ url: '/pages/customer/feedback/feedback' })
        }
      },
      fail: (err) => {
        console.log('showActionSheet失败:', err)
      }
    })
  }
})