// pages/customer/checkout/checkout.js
Page({
  data: {
    cartList: [],
    totalPrice: 0
  },

  onLoad(options) {
    console.log('支付页面加载', options);

    const cart = wx.getStorageSync('shoppingCart') || [];
    const total = options.total || cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    this.setData({
      cartList: cart,
      totalPrice: total
    });

    console.log('购物车商品:', cart);
    console.log('总价:', total);
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 支付
  async pay() {
    if (this.data.cartList.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '下单中...', mask: true });

    try {
      const openidRes = await wx.cloud.callFunction({
        name: 'getOpenId'
      });
      const openid = openidRes.result.openid;

      if (!openid) {
        throw new Error('获取用户标识失败');
      }

      const goods = this.data.cartList.map(item => ({
        goodsId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        pickupStatus: '待取货',
        images: item.image ? [item.image] : []
      }));

      const res = await wx.cloud.callFunction({
        name: 'createOrder',
        data: {
          openid: openid,
          goods: goods,
          totalPrice: parseFloat(this.data.totalPrice),
          remark: ''
        }
      });

      console.log('创建订单结果:', res);

      if (res.result && res.result.code === 0) {
        wx.removeStorageSync('shoppingCart');
        console.log('购物车已清空');

        wx.hideLoading();
        wx.showToast({
          title: '下单成功',
          icon: 'success',
          duration: 2000
        });

        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2];
              if (prevPage && prevPage.loadCartFromStorage) {
                prevPage.loadCartFromStorage();
              }
            }
          });
        }, 2000);
      } else {
        throw new Error(res.result?.message || '下单失败');
      }
    } catch (err) {
      console.error('下单失败', err);
      wx.hideLoading();
      wx.showToast({
        title: err.message || '下单失败，请重试',
        icon: 'none'
      });
    }
  }
});