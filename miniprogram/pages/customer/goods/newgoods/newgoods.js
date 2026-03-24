// pages/customer/goods/newgoods/newgoods.js
Page({
<<<<<<< Updated upstream
<<<<<<< Updated upstream

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})
=======
=======
>>>>>>> Stashed changes
  data: {
    totalCount: 5,
    goodsList: [],
    showCartModal: false,
    cartList: [],
    cartTotalCount: 0,
    cartTotalPrice: 0
  },

  onLoad(options) {
    this.loadGoodsData();
    this.loadCartFromStorage();
  },

  // 加载商品数据
  loadGoodsData() {
    // TODO: 替换为真实接口
    this.setData({
      goodsList: [
        {
          id: '1',
          name: '珊迪氧气罩',
          price: 99,
          statusText: '已预定33件',
          spec: '0.5kg',
          image: '/images/goods_sample.png',
          badgeText: '接龙预定',
          badgeClass: 'preorder',
          actionText: '参与接龙',
          actionType: 'joinGroup',
          type: 'preorder'
        },
        {
          id: '2',
          name: '珊迪氧气罩',
          price: 99,
          statusText: '库存剩余33件',
          spec: '0.5kg',
          image: '/images/goods_sample.png',
          badgeText: '现货订购',
          badgeClass: 'spot',
          actionText: '加入购物车',
          actionType: 'addToCart',
          type: 'spot'
        },
        {
          id: '3',
          name: '海绵宝宝捕鱼网',
          price: 129,
          statusText: '已预定56件',
          spec: '1.0kg',
          image: '/images/goods_sample.png',
          badgeText: '接龙预定',
          badgeClass: 'preorder',
          actionText: '参与接龙',
          actionType: 'joinGroup',
          type: 'preorder'
        },
        {
          id: '4',
          name: '派大星渔网',
          price: 89,
          statusText: '已预定28件',
          spec: '0.8kg',
          image: '/images/goods_sample.png',
          badgeText: '接龙预定',
          badgeClass: 'preorder',
          actionText: '参与接龙',
          actionType: 'joinGroup',
          type: 'preorder'
        },
        {
          id: '5',
          name: '章鱼哥的笛子',
          price: 199,
          statusText: '库存剩余15件',
          spec: '木质',
          image: '/images/goods_sample.png',
          badgeText: '现货订购',
          badgeClass: 'spot',
          actionText: '加入购物车',
          actionType: 'addToCart',
          type: 'spot'
        }
      ]
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 显示购物车详情
  showCartDetail() {
    this.setData({
      showCartModal: true
    });
  },

  // 隐藏购物车详情
  hideCartDetail() {
    this.setData({
      showCartModal: false
    });
  },

  // 从本地缓存加载购物车
  loadCartFromStorage() {
    const cart = wx.getStorageSync('shoppingCart') || [];
    this.updateCartData(cart);
  },

  // 保存购物车到本地缓存
  saveCartToStorage(cart) {
    wx.setStorageSync('shoppingCart', cart);
  },

  // 更新购物车数据
  updateCartData(cart) {
    let totalCount = 0;
    let totalPrice = 0;
    cart.forEach(item => {
      totalCount += item.quantity;
      totalPrice += item.price * item.quantity;
    });
    this.setData({
      cartList: cart,
      cartTotalCount: totalCount,
      cartTotalPrice: totalPrice.toFixed(2)
    });
    this.saveCartToStorage(cart);
  },

  // 添加到购物车
  onAddToCart(e) {
    const { id, name, price, image, type } = e.detail;
    const cart = [...this.data.cartList];
    const existingItem = cart.find(item => item.id === id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id,
        name,
        price,
        image,
        type: type || 'spot',
        quantity: 1
      });
    }

    this.updateCartData(cart);
    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    });
  },

  // 参与接龙
  onJoinGroup(e) {
    const { id, name, price, image } = e.detail;
    wx.showModal({
      title: '参与接龙',
      content: `确定要参与「${name}」的接龙预定吗？`,
      success: (res) => {
        if (res.confirm) {
          const cart = [...this.data.cartList];
          const existingItem = cart.find(item => item.id === id);

          if (existingItem) {
            existingItem.quantity += 1;
          } else {
            cart.push({
              id,
              name,
              price,
              image,
              type: 'preorder',
              quantity: 1
            });
          }

          this.updateCartData(cart);
          wx.showToast({
            title: '已加入接龙',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  // 商品操作
  onAction(e) {
    const { item } = e.currentTarget.dataset;
    if (item.actionType === 'addToCart') {
      this.onAddToCart({
        detail: {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          type: item.type
        }
      });
    } else if (item.actionType === 'joinGroup') {
      this.onJoinGroup({
        detail: {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image
        }
      });
    }
  },

  // 增加数量
  increaseQuantity(e) {
    const { id } = e.currentTarget.dataset;
    const cart = [...this.data.cartList];
    const item = cart.find(item => item.id === id);
    if (item) {
      item.quantity += 1;
      this.updateCartData(cart);
    }
  },

  // 减少数量
  decreaseQuantity(e) {
    const { id } = e.currentTarget.dataset;
    let cart = [...this.data.cartList];
    const itemIndex = cart.findIndex(item => item.id === id);
    if (itemIndex !== -1) {
      if (cart[itemIndex].quantity > 1) {
        cart[itemIndex].quantity -= 1;
        this.updateCartData(cart);
      } else {
        cart.splice(itemIndex, 1);
        this.updateCartData(cart);
      }
    }
  },

  // 合并结算
  checkout() {
    if (this.data.cartList.length === 0) {
      wx.showToast({
        title: '购物车是空的',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({
      showCartModal: false
    });

    wx.navigateTo({
      url: '/pages/customer/checkout/checkout?total=' + this.data.cartTotalPrice
    });
  }
<<<<<<< Updated upstream
});
>>>>>>> Stashed changes
=======
});
>>>>>>> Stashed changes
