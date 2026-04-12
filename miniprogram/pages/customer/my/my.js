// pages/customer/my/my.js
Page({
  data: {
    userInfo: {
      nickName: '游客',
      avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png',
      phoneNumber: '',
      role: ''
    },
    notificationEnabled: true,
    loading: false,
    loginLoading: false,
    contactLoading: false
  },

  onLoad(options) {
    this.checkLoginStatus()
  },

  onShow() {
    this.checkLoginStatus()
  },

  async checkLoginStatus() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      })

      if (res.result.success && res.result.user) {
        this.setData({
          userInfo: {
            nickName: res.result.user.nickName || '微信用户',
            avatarUrl: res.result.user.avatarUrl || 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png',
            phoneNumber: res.result.user.phoneNumber || '',
            role: res.result.user.role || 'customer',
            openid: res.result.user.openid
          }
        })
      } else {
        this.setData({
          userInfo: {
            nickName: '游客',
            avatarUrl: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png',
            phoneNumber: '',
            role: ''
          }
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async handleLogin() {
    // 如果已登录，不重复授权
    if (this.data.userInfo.openid) {
      return
    }

    this.setData({ loginLoading: true })
    try {
      // 1. 获取微信用户信息
      const { userInfo } = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善会员资料',
          success: resolve,
          fail: reject
        })
      })

      // 2. 立即显示用户头像和昵称（不等云函数）
      this.setData({
        'userInfo.nickName': userInfo.nickName,
        'userInfo.avatarUrl': userInfo.avatarUrl
      })

      // 3. 保存到云数据库
      const saveRes = await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: {
          nickName: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        }
      })

      if (saveRes.result.success) {
        // 4. 重新获取完整用户信息（获取 openid 等）
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
      this.setData({ loginLoading: false })
    }
  },

  // 手动输入手机号
  editPhoneNumber() {
    wx.showModal({
      title: '绑定手机号',
      editable: true,
      placeholderText: '请输入手机号码',
      success: async (res) => {
        if (res.confirm && res.content) {
          const phoneNumber = res.content.trim()
          
          if (phoneNumber === '') {
            wx.showToast({
              title: '请输入手机号码',
              icon: 'none'
            })
            return
          }
          
          wx.showLoading({ title: '保存中...' })
          try {
            await wx.cloud.callFunction({
              name: 'saveUserInfo',
              data: {
                phoneNumber: phoneNumber
              }
            })
            
            this.setData({
              'userInfo.phoneNumber': phoneNumber
            })
            
            wx.showToast({
              title: '绑定成功',
              icon: 'success'
            })
          } catch (err) {
            console.error('保存手机号失败', err)
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  goToOrderCenter() {
    wx.navigateTo({ url: '/pages/customer/myOrder/myOrder' })
  },

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

  async contactService() {
    const that = this
    wx.showActionSheet({
      itemList: ['联系商家', '售后反馈'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          that.setData({ contactLoading: true })
          try {
            const orderRes = await wx.cloud.callFunction({
              name: 'getOrderList',
              data: {
                openid: that.data.userInfo.openid
              }
            })

            if (!orderRes.result || orderRes.result.code !== 0 || !orderRes.result.data || orderRes.result.data.length === 0) {
              that.setData({ contactLoading: false })
              wx.showToast({ title: '暂无订单信息', icon: 'none' })
              return
            }

            const firstOrder = orderRes.result.data[0]
            const storeName = firstOrder.store || 'MC_store'

            const merchantRes = await wx.cloud.callFunction({
              name: 'getUserInfo',
              data: { role: 'merchant', store: storeName }
            })

            that.setData({ contactLoading: false })

            if (merchantRes.result && merchantRes.result.success && merchantRes.result.user) {
              const merchantUser = merchantRes.result.user
              const wechat = merchantUser.wechat || 'wechat_ymc123456'
              const phoneNumber = merchantUser.phoneNumber || '暂无电话信息'

              wx.showModal({
                title: storeName + ' 商家信息',
                content: '商家微信号：' + wechat + '\n\n' + '商家电话：' + phoneNumber,
                showCancel: false,
                confirmText: '确定',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.showActionSheet({
                      itemList: ['复制微信号', '复制电话'],
                      success: (res) => {
                        if (res.tapIndex === 0) {
                          wx.setClipboardData({
                            data: wechat,
                            success: () => {
                              wx.showToast({ title: '微信号已复制', icon: 'success' })
                            }
                          })
                        } else if (res.tapIndex === 1) {
                          wx.setClipboardData({
                            data: phoneNumber,
                            success: () => {
                              wx.showToast({ title: '电话已复制', icon: 'success' })
                            }
                          })
                        }
                      }
                    })
                  }
                }
              })
            } else {
              wx.showToast({ title: '暂未获取到商家信息', icon: 'none' })
            }
          } catch (err) {
            that.setData({ contactLoading: false })
            console.error('获取商家信息失败', err)
            wx.showToast({ title: '获取失败，请重试', icon: 'none' })
          }
        } else if (res.tapIndex === 1) {
          wx.navigateTo({ url: '/pages/customer/feedback/feedback' })
        }
      },
      fail: (err) => {
        console.error('showActionSheet失败:', err)
      }
    })
  },

  ScanQR() {
    wx.navigateTo({
      url: '/pages/customer/myOrder/myOrder?tab=waiting'
    })
  }
})