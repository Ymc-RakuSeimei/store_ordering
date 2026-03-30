// pages/customer/myOrder/components/all/all.js
Component({
  data: {
    orderStatistics: {
      total: 4,
      completed: 2
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
        console.log('用户openid:', openid);
        const res = await wx.cloud.callFunction({
          name: 'getOrderList',
          data: {
            status: 'all',
            openid
          }
        });

        console.log('云函数返回结果:', res);
        if (res && res.result && res.result.code === 0) {
          const orders = res.result.data || [];
          console.log('获取到的订单数量:', orders.length);
          // 提取所有订单中的商品
          const allGoods = [];
          orders.forEach(order => {
            console.log('处理订单:', order._id);
            if (order.goods && order.goods.length > 0) {
              order.goods.forEach(goods => {
                console.log('处理商品:', goods.name, '状态:', goods.pickupStatus);
                // 处理商品图片，支持字符串和数组格式
                let image = '';
                if (goods.images) {
                  if (Array.isArray(goods.images) && goods.images.length > 0) {
                    image = goods.images[0];
                  } else if (typeof goods.images === 'string' && goods.images) {
                    image = goods.images;
                  }
                }
                
                allGoods.push({
                  id: `${order._id}_${goods.goodsId || goods.id}`,
                  image: image,
                  name: goods.name || '商品',
                  price: goods.price || 0,
                  quantity: goods.quantity || 1,
                  status: goods.pickupStatus || order.status
                });
              });
            }
          });

          console.log('提取的商品数量:', allGoods.length);
          console.log('已完成商品数量:', allGoods.filter(item => item.status === '已取货' || item.status === '已完成').length);
          this.setData({
            orderList: allGoods,
            orderStatistics: {
              total: allGoods.length,
              completed: allGoods.filter(item => item.status === '已取货' || item.status === '已完成').length
            }
          });
        }
      } catch (err) {
        console.error('加载订单数据失败:', err);
        // 加载失败时使用空数据
        this.setData({
          orderList: [],
          orderStatistics: {
            total: 0,
            completed: 0
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
    },


  }
});