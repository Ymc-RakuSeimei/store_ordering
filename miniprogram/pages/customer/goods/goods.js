// pages/customer/goods/goods.js
Page({
  data: {
    currentTab: 'all',
    showCartModal: false,
    cartList: [],
    cartTotalCount: 0,
    cartTotalPrice: 0
  },

  onLoad(options) {
    if (options.tab) {
      this.setData({
        currentTab: options.tab
      });
    }
    this.loadCartFromStorage();
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
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

  // 合并结算 - 跳转到虚拟支付页
  checkout() {
    if (this.data.cartList.length === 0) {
      wx.showToast({
        title: '购物车是空的',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 关闭购物车弹窗
    this.setData({
      showCartModal: false
    });
    
    // 跳转到支付页面
    wx.navigateTo({
      url: '/pages/customer/checkout/checkout?total=' + this.data.cartTotalPrice
    });
  }
});