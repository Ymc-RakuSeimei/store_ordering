// pages/customer/goods/newgoods/newgoods.js
Page({
  data: {
    totalCount: 0,
    goodsList: [],
    showCartModal: false,
    cartList: [],
    cartTotalCount: 0,
    cartTotalPrice: 0,
    loading: false
  },

  onLoad(options) {
    this.loadGoodsData();
    this.loadCartFromStorage();
  },

  onShow() {
    this.loadCartFromStorage();
    this.loadGoodsData();
  },

  async loadGoodsData() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGoodsList',
        data: {
          category: '',
          page: 0,
          limit: 100,
          sortField: 'createdAt',
          sortOrder: 'desc'
        }
      });

      if (res.result && res.result.code === 0) {
        const allGoods = res.result.data;
        const todayGoods = this.filterTodayGoods(allGoods);
        const goodsList = this.formatGoodsData(todayGoods);
        this.setData({
          goodsList: goodsList,
          totalCount: goodsList.length
        });
        console.log('今日上新商品数量:', goodsList.length);
      } else {
        throw new Error(res.result?.message || '获取失败');
      }
    } catch (err) {
      console.error('加载商品失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 筛选 24 小时内上架的商品（使用 createdAt，不是 updatedAt）
  filterTodayGoods(goodsList) {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return goodsList.filter(item => {
      // 使用 createdAt 作为判断基点（商品上架时间，不会变化）
      const createTime = item.createdAt;
      if (!createTime) return false;
      
      let itemDate;
      if (createTime && createTime.$date) {
        itemDate = new Date(createTime.$date);
      } else if (createTime) {
        itemDate = new Date(createTime);
      } else {
        return false;
      }
      
      return itemDate >= twentyFourHoursAgo;
    });
  },

  // 格式化商品数据（保持不变）
  formatGoodsData(goodsList) {
    if (!goodsList || goodsList.length === 0) return [];
    
    return goodsList.map(item => {
      const isPreorder = item.type === 'preorder';
      const isSpot = item.type === 'spot' || item.type === 'special';
      const isSpecial = item.type === 'special';
      
      let imageUrl = '';
      if (item.images && item.images.length > 0 && item.images[0]) {
        imageUrl = item.images[0];
      }
      if (imageUrl && (imageUrl === '图一' || imageUrl === '图二')) {
        imageUrl = '';
      }
      
      const cart = wx.getStorageSync('shoppingCart') || [];
      const goodsId = item.goodsId || item._id;
      const cartItem = cart.find(cartItem => cartItem.id === goodsId);
      const cartQuantity = cartItem ? parseInt(cartItem.quantity) : 0;
      
      return {
        id: goodsId,
        name: item.name || '商品名称',
        price: isSpecial ? (item.specialPrice || item.price) : item.price,
        originalPrice: isSpecial ? item.price : null,
        statusText: isPreorder 
          ? `已预定${item.totalBooked || 0}件` 
          : `库存剩余${item.stock || 0}件`,
        spec: item.specs || '无规格',
        image: imageUrl,
        badgeText: isPreorder ? '接龙预定' : (isSpot ? '现货订购' : ''),
        badgeClass: isPreorder ? 'preorder' : (isSpot ? 'spot' : ''),
        priceClass: isSpecial ? 'special-price' : '',
        actionText: isPreorder ? '参与接龙' : '加入购物车',
        actionType: isPreorder ? 'joinGroup' : 'addToCart',
        type: item.type,
        cartQuantity: cartQuantity
      };
    });
  },

  // 跳转到详情页（需要修复）
  goToDetail(e) {
    const { item } = e.currentTarget.dataset;
    if (item.type === 'preorder') {
      wx.navigateTo({
        url: `/pages/preorder/join/join?id=${item.id}`
      });
    } else {
      wx.navigateTo({
        url: `/pages/customer/goods/detail/detail?id=${item.id}`
      });
    }
  },

  // 其他方法保持不变...
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  stopPropagation() {},

  updateGoodsCartQuantity(goodsId) {
    const updatedGoodsList = this.data.goodsList.map(item => {
      if (item.id === goodsId) {
        const cart = wx.getStorageSync('shoppingCart') || [];
        const cartItem = cart.find(cartItem => cartItem.id === goodsId);
        return {
          ...item,
          cartQuantity: cartItem ? cartItem.quantity : 0
        };
      }
      return item;
    });
    this.setData({ goodsList: updatedGoodsList });
  },

  showCartDetail() {
    this.setData({ showCartModal: true });
  },

  hideCartDetail() {
    this.setData({ showCartModal: false });
  },

  loadCartFromStorage() {
    const cart = wx.getStorageSync('shoppingCart') || [];
    this.updateCartData(cart);
  },

  saveCartToStorage(cart) {
    wx.setStorageSync('shoppingCart', cart);
  },

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
    this.updateGoodsCartQuantity(id);
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
  },

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
          this.updateGoodsCartQuantity(id);
          wx.showToast({ title: '已加入接龙', icon: 'success', duration: 1500 });
        }
      }
    });
  },

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

  increaseQuantity(e) {
    const { id } = e.currentTarget.dataset;
    const cart = [...this.data.cartList];
    const item = cart.find(item => item.id === id);
    if (item) {
      item.quantity += 1;
      this.updateCartData(cart);
      this.updateGoodsCartQuantity(id);
    }
  },

  decreaseQuantity(e) {
    const { id } = e.currentTarget.dataset;
    let cart = [...this.data.cartList];
    const itemIndex = cart.findIndex(item => item.id === id);
    if (itemIndex !== -1) {
      if (cart[itemIndex].quantity > 1) {
        cart[itemIndex].quantity -= 1;
        this.updateCartData(cart);
        this.updateGoodsCartQuantity(id);
      } else {
        cart.splice(itemIndex, 1);
        this.updateCartData(cart);
        this.updateGoodsCartQuantity(id);
      }
    }
  },

  checkout() {
    console.log('checkout 被调用');
    console.log('购物车数量:', this.data.cartList.length);
    
    if (this.data.cartList.length === 0) {
      wx.showToast({ title: '购物车是空的', icon: 'none', duration: 2000 });
      return;
    }

    this.setData({ showCartModal: false });
    
    console.log('准备跳转到支付页面');
    wx.navigateTo({
      url: '/pages/customer/checkout/checkout?total=' + this.data.cartTotalPrice,
      success: () => console.log('跳转成功'),
      fail: (err) => console.error('跳转失败', err)
    });
  }
});