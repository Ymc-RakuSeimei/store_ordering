// pages/customer/my/my.js
Page({
  data: {
    userInfo: {
      nickName: '游客',
      avatarUrl: '',
      phoneNumber: '',
      role: '',
      openid: ''
    },
    notificationEnabled: true,
    loading: false,
    loginLoading: false,
    contactLoading: false,
    showNicknameInput: false  // 是否显示昵称输入框
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
        const user = res.result.user
        const avatarUrl = (user.avatarUrl && user.avatarUrl !== '') 
          ? user.avatarUrl 
          : ''
        
        // 判断是否需要显示昵称输入框（昵称为空或为默认值）
        const needNickname = !user.nickName || user.nickName === '微信用户' || user.nickName === '游客'
        
        this.setData({
          userInfo: {
            nickName: user.nickName || '游客',
            avatarUrl: avatarUrl,
            phoneNumber: user.phoneNumber || '',
            role: user.role || 'customer',
            openid: user.openid
          },
          showNicknameInput: needNickname
        })
      } else {
        this.setData({
          userInfo: {
            nickName: '游客',
            avatarUrl: '',
            phoneNumber: '',
            role: '',
            openid: ''
          },
          showNicknameInput: true
        })
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 选择头像（新方式）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    if (avatarUrl) {
      // 先更新页面显示
      this.setData({
        'userInfo.avatarUrl': avatarUrl
      })
      // 保存到数据库
      this.saveUserInfoToDB({
        avatarUrl: avatarUrl
      })
    }
  },

  // 输入昵称（新方式）
  async onInputNickname(e) {
    const nickName = e.detail.value
    if (nickName && nickName.trim()) {
      // 先更新页面显示
      this.setData({
        'userInfo.nickName': nickName.trim(),
        showNicknameInput: false
      })
      // 保存到数据库
      await this.saveUserInfoToDB({
        nickName: nickName.trim()
      })
      wx.showToast({ title: '昵称更新成功', icon: 'success' })
    }
  },

  // 保存用户信息到数据库
  async saveUserInfoToDB(data) {
    try {
      const saveRes = await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: data
      })
      if (!saveRes.result.success) {
        console.error('保存失败', saveRes.result)
      }
    } catch (err) {
      console.error('保存用户信息失败', err)
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