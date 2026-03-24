// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请升级微信版本以使用云开发');
      return;
    }
    wx.cloud.init({
      env: 'cloud1-2gltiqs6a2c5cd76',
      traceUser: true,
    });

    this.getUserRole()
      .then(role => console.log('用户角色:', role))
      .catch(err => {
        console.error('获取角色失败', err);
        this.globalData.userRole = 'customer';
      });
  },

  /**
   * 获取用户角色（自动注册）
   * @param {boolean} forceMerchant - 是否强制返回商家角色（仅开发测试用）
   * @returns {Promise<string>} 角色名 'customer' 或 'merchant'
   */
  getUserRole(forceMerchant = false) {
    return new Promise((resolve, reject) => {
      if (this.globalData.userRole && !forceMerchant) {
        resolve(this.globalData.userRole);
        return;
      }

      wx.cloud.callFunction({
        name: 'getUserRole',
        data: { forceMerchant },
        success: res => {
          console.log('云函数返回完整结果:', res);
          const result = res.result;
          if (result.code === 0) {
            this.globalData.userRole = result.role;
            this.globalData.userInfo = result.user;
            resolve(result.role);
          } else {
            reject(new Error(result.message || '获取角色失败'));
          }
        },
        fail: err => {
          console.error('云函数调用失败', err);
          reject(err);
        }
      });
    });
  },

  /**
   * 切换角色（仅开发/体验版可用，生产环境需移除）
   * @param {string} targetRole - 目标角色 'customer' 或 'merchant'
   * @returns {Promise<void>}
   */
  switchRole(targetRole) {
    if (!['customer', 'merchant'].includes(targetRole)) {
      return Promise.reject(new Error('角色必须是 customer 或 merchant'));
    }
    const envVersion = wx.getAccountInfoSync().miniProgram.envVersion;
    if (envVersion !== 'develop' && envVersion !== 'trial') {
      return Promise.reject(new Error('仅开发/体验版支持角色切换'));
    }

    return wx.cloud.callFunction({
      name: 'switchRole',
      data: { targetRole }
    }).then(res => {
      if (res.result.code === 0) {
        this.globalData.userRole = null;
        return this.getUserRole();
      }
      throw new Error(res.result.message);
    });
  },

  globalData: {
    userRole: null,
    userInfo: null
  }
});