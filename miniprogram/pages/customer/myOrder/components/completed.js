// pages/customer/myOrder/components/completed/completed.js
Component({
  data: {
    completedStatistics: {
      total: 2
    },
    orderList: []
  },

  lifetimes: {
    attached() {
      this.loadOrderData();
    }
  },

  methods: {
    async loadOrderData() {
      try {
        const openid = await this.getOpenid();
        const res = await wx.cloud.callFunction({
          name: 'getOrderList',
          data: {
            status: 'all',
            openid
          }
        });

        if (res && res.result && res.result.code === 0) {
          const orders = res.result.data || [];
          const completedGoods = [];
          
          orders.forEach(order => {
            if (order.goods && order.goods.length > 0) {
              order.goods.forEach(goods => {
                if (goods.pickupStatus === '已取货') {
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
                    quantity: goods.quantity || 1,
                    status: goods.pickupStatus || order.status
                  });
                }
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

        if (app.globalData.userInfo?.openid) {
          resolve(app.globalData.userInfo.openid);
          return;
        }

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