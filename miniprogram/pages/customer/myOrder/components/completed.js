// pages/customer/myOrder/components/completed/completed.js
Component({
  data: {
    completedStatistics: {
      total: 2    // 总完成件数
    },
    orderList: []
  },

  lifetimes: {
    attached() {
      this.loadOrderData();
    }
  },

  methods: {
    /**
     * 加载已完成订单数据
     */
    async loadOrderData() {
      try {
        const openid = await this.getOpenid();
        const res = await wx.cloud.callFunction({
          name: 'getOrderList',
          data: {
            status: 'completed',
            openid
          }
        });

        if (res && res.result && res.result.code === 0) {
          const orders = res.result.data || [];
          // 提取已完成订单中的商品
          const completedGoods = [];
          orders.forEach(order => {
            if (order.goods && order.goods.length > 0) {
              order.goods.forEach(goods => {
                // 处理商品图片，支持字符串和数组格式
                let image = '';
                if (goods.images) {
                  if (Array.isArray(goods.images) && goods.images.length > 0) {
                    image = goods.images[0];
                  } else if (typeof goods.images === 'string' && goods.images) {
                    image = goods.images;
                  }
                }
                
                completedGoods.push({
                  id: `${order._id}_${goods.goodsId || goods.id}`,
                  image: image,
                  name: goods.name || '商品',
                  price: goods.price || 0,
                  status: goods.pickupStatus || order.status
                });
              });
            }
          });

          this.setData({
            orderList: completedGoods,
            completedStatistics: {
              total: completedGoods.length
            }
          });
        }
      } catch (err) {
        console.error('加载已完成订单数据失败:', err);
        // 加载失败时使用空数据
        this.setData({
          orderList: [],
          completedStatistics: {
            total: 0
          }
        });
      }
    },

    getOpenid() {
      return new Promise((resolve, reject) => {
        const app = getApp();

        // 优先从全局数据获取openid
        if (app.globalData.userInfo?.openid) {
          resolve(app.globalData.userInfo.openid);
          return;
        }

        // 调用云函数获取当前登录用户的openid
        wx.cloud.callFunction({
          name: 'getOpenId',
          success: res => {
            const openid = res.result.openid;
            if (openid) {
              if (!app.globalData.userInfo) app.globalData.userInfo = {};
              app.globalData.userInfo.openid = openid;
              resolve(openid);
            } else {
              reject(new Error('获取 openid 失败'));
            }
          },
          fail: (err) => {
            console.error('调用getOpenId云函数失败:', err);
            reject(new Error('获取 openid 失败'));
          }
        });
      });
    }
  }
});