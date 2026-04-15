// pages/customer/index/index.js
Page({
  data: {
    userInfo: {
      nickName: '游客',
      avatarUrl: ''
    },
    unreadMessageCount: 0,
    showNicknameInput: false
  },

  onLoad() {
    this.getUserInfo();
    this.getUnreadMessageCount();
  },

  onShow() {
    if (!this._isLoading) {
      this.getUserInfo();
    }
    this.getUnreadMessageCount();
  },

  async getUserInfo() {
    if (this._isLoading) return;
    this._isLoading = true;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      });

      if (res.result.success && res.result.user) {
        const user = res.result.user;
        let avatarUrl = '';
        if (user.avatarUrl && user.avatarUrl !== '') {
          avatarUrl = user.avatarUrl;
        }
        
        // 判断是否需要显示昵称输入框
        const needNickname = !user.nickName || user.nickName === '微信用户' || user.nickName === '游客';
        
        this.setData({
          userInfo: {
            nickName: user.nickName || '游客',
            avatarUrl: avatarUrl
          },
          showNicknameInput: needNickname
        });
      } else {
        this.setData({
          userInfo: {
            nickName: '游客',
            avatarUrl: ''
          },
          showNicknameInput: true
        });
      }
    } catch (err) {
      this.setData({
        userInfo: {
          nickName: '游客',
          avatarUrl: ''
        },
        showNicknameInput: true
      });
    } finally {
      this._isLoading = false;
    }
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    if (avatarUrl) {
      // 立即更新页面显示
      this.setData({
        'userInfo.avatarUrl': avatarUrl
      });
      // 保存到数据库
      this.saveUserInfoToDB({ avatarUrl: avatarUrl });
    }
  },

  // 输入昵称
  async onInputNickname(e) {
    const nickName = e.detail.value;
    if (nickName && nickName.trim()) {
      // 立即更新页面显示
      this.setData({
        'userInfo.nickName': nickName.trim(),
        showNicknameInput: false
      });
      // 保存到数据库
      await this.saveUserInfoToDB({ nickName: nickName.trim() });
      wx.showToast({ title: '昵称更新成功', icon: 'success' });
    }
  },

  // 保存用户信息到数据库
  async saveUserInfoToDB(data) {
    try {
      await wx.cloud.callFunction({
        name: 'saveUserInfo',
        data: data
      });
    } catch (err) {
      console.error('保存用户信息失败', err);
    }
  },

  async getUnreadMessageCount() {
    try {
      const app = getApp();
      const openid = app.globalData.openid || await app.getOpenId();
      if (!openid) {
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'getMessageList',
        data: {
          openid,
          limit: 100,
          page: 0
        }
      });

      if (res.result.code === 0) {
        this.setData({
          unreadMessageCount: res.result.data.filter((item) => !item.isRead).length
        });
      }
    } catch (err) {
      // 静默失败
    }
  },

  goToNewGoods() {
    wx.navigateTo({ url: '/pages/customer/goods/newgoods/newgoods' });
  },

  goToShopList() {
    wx.switchTab({ url: '/pages/customer/goods/goods' });
  },

  goToMyOrder() {
    wx.navigateTo({ url: '/pages/customer/myOrder/myOrder' });
  },

  goToFeedback() {
    wx.navigateTo({
      url: '/pages/customer/myOrder/myOrder?tab=waiting'
    });
  },

  goToMessage() {
    wx.navigateTo({ url: '/pages/customer/message/message' });
  },

  openAiAssistant() {
    wx.navigateTo({
      url: '/pages/ai-assistant/index?role=customer'
    });
  }
});