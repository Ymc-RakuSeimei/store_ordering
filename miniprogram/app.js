// app.js
const originalPage = Page;

function isPromiseLike(value) {
  return value && typeof value.then === 'function';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForLoadingFinish(pageInstance, timeout = 2500) {
  const pageData = pageInstance && pageInstance.data;

  if (!pageData || !Object.prototype.hasOwnProperty.call(pageData, 'loading')) {
    return delay(800);
  }

  const startedAt = Date.now();

  return new Promise((resolve) => {
    const checkLoading = () => {
      const currentData = (pageInstance && pageInstance.data) || {};

      if (!currentData.loading || Date.now() - startedAt >= timeout) {
        resolve();
        return;
      }

      setTimeout(checkLoading, 120);
    };

    checkLoading();
  });
}

function tryCallMethod(pageInstance, methodName, args = []) {
  const method = pageInstance && pageInstance[methodName];

  if (typeof method !== 'function') {
    return { called: false, result: undefined };
  }

  return {
    called: true,
    result: method.apply(pageInstance, args)
  };
}

function runDefaultRefresh(pageInstance, originalOptions) {
  const data = (pageInstance && pageInstance.data) || {};

  const refreshTasks = [
    () => tryCallMethod(pageInstance, 'refreshPageData'),
    () => tryCallMethod(pageInstance, 'loadAllOrders'),
    () => (data.customerKey ? tryCallMethod(pageInstance, 'loadOrderDetail', [data.customerKey]) : { called: false }),
    () => (data.pickupCode ? tryCallMethod(pageInstance, 'loadCustomerOrders', [data.pickupCode]) : { called: false }),
    () => tryCallMethod(pageInstance, 'loadGoods'),
    () => tryCallMethod(pageInstance, 'loadAllGoodsData'),
    () => tryCallMethod(pageInstance, 'loadGoodsData'),
    () => tryCallMethod(pageInstance, 'loadPreorderList'),
    () => tryCallMethod(pageInstance, 'loadNotifications'),
    () => tryCallMethod(pageInstance, 'loadMerchantProfile'),
    () => tryCallMethod(pageInstance, 'loadDataCenter'),
    () => tryCallMethod(pageInstance, 'getUserInfoAndOrders'),
    () => tryCallMethod(pageInstance, 'checkLoginStatus'),
    () => tryCallMethod(pageInstance, 'getUserInfo'),
    () => tryCallMethod(pageInstance, 'loadDragonDetail'),
    () => tryCallMethod(pageInstance, 'loadData'),
    () => tryCallMethod(pageInstance, 'fetchData'),
    () => tryCallMethod(pageInstance, 'refreshData'),
    () => tryCallMethod(pageInstance, 'initRedirect'),
    () => tryCallMethod(pageInstance, '__originalOnShow'),
    () => tryCallMethod(pageInstance, '__originalOnLoad', [originalOptions || {}])
  ];

  let refreshResult;

  for (let index = 0; index < refreshTasks.length; index += 1) {
    const taskResult = refreshTasks[index]();

    if (taskResult && taskResult.called) {
      refreshResult = taskResult.result;
      break;
    }
  }

  if (typeof pageInstance.loadCartFromStorage === 'function') {
    pageInstance.loadCartFromStorage();
  }

  return refreshResult;
}

Page = function wrapPageWithPullDownRefresh(pageOptions) {
  const originalOnLoad = pageOptions.onLoad;
  const originalOnShow = pageOptions.onShow;
  const originalOnPullDownRefresh = pageOptions.onPullDownRefresh;

  return originalPage({
    ...pageOptions,

    __originalOnLoad: originalOnLoad,
    __originalOnShow: originalOnShow,

    onLoad(options) {
      this.__pageLoadOptions = options || {};

      if (typeof originalOnLoad === 'function') {
        return originalOnLoad.call(this, options || {});
      }

      return undefined;
    },

    onShow() {
      if (typeof originalOnShow === 'function') {
        return originalOnShow.call(this);
      }

      return undefined;
    },

    onPullDownRefresh() {
      Promise.resolve()
        .then(() => {
          if (typeof originalOnPullDownRefresh === 'function') {
            return originalOnPullDownRefresh.call(this);
          }

          return runDefaultRefresh(this, this.__pageLoadOptions);
        })
        .then((result) => (isPromiseLike(result) ? result : result))
        .then(() => waitForLoadingFinish(this))
        .catch((error) => {
          console.error('onPullDownRefresh error', error);
          wx.showToast({
            title: '刷新失败，请重试',
            icon: 'none'
          });
        })
        .finally(() => {
          wx.stopPullDownRefresh();
        });
    }
  });
};

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
