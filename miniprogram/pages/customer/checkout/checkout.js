// pages/customer/checkout/checkout.js
Page({
  data: {
    cartList: [],
    totalPrice: 0,
    remark: ''
  },

  onLoad(options) {
    const cart = wx.getStorageSync('shoppingCart') || [];
    const total = options.total || cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    this.setData({
      cartList: cart,
      totalPrice: total
    });
  },

  goBack() {
    wx.navigateBack();
  },

  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

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

      // 前端只负责把购物车商品基础信息传给云函数。
      // 真实商品类型、库存、pickupStatus 和 totalBooked 的处理统一交给后端。
      const goods = this.data.cartList.map((item) => ({
        goodsId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        type: item.type || 'spot',
        pickupStatus: item.type === 'preorder' ? '未到货' : '待取货',
        images: item.image ? [item.image] : []
      }));

      const res = await wx.cloud.callFunction({
        name: 'createOrder',
        data: {
          openid,
          goods,
          customerInfo: {},
          totalPrice: parseFloat(this.data.totalPrice),
          remark: this.data.remark
        }
      });

      if (res.result && res.result.code === 0) {
        wx.removeStorageSync('shoppingCart');
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
