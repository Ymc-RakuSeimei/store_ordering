// pages/customer/goods/goods.js
Page({
  data: {
    currentTab: 'all',
    searchKeyword: '',
    showCartModal: false,
    cartList: [],
    cartTotalCount: 0,
    cartTotalPrice: 0,
    goodsData: {
      all: [],
      spot: [],
      preorder: [],
      special: []
    },
    originalGoodsData: {
      all: [],
      spot: [],
      preorder: [],
      special: []
    }
  },

  onLoad(options) {
    if (options.tab) {
      this.setData({ currentTab: options.tab });
    }
    this.loadCartFromStorage();
    this.loadAllGoodsData();
  },

  onShow() {
    // 每次显示页面时刷新购物车数据（确保从其他页面返回时更新）
    this.loadCartFromStorage();
    // 直接更新商品列表中的购物车数量，避免重新加载
    this.updateAllGoodsCartQuantity();
  },

  // 加载所有商品数据
  async loadAllGoodsData() {
    wx.showLoading({ title: '加载中...' });
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

        const spotList = allGoods.filter(item => item.type === 'spot');
        const preorderList = allGoods.filter(item => item.type === 'preorder');
        const specialList = allGoods.filter(item => item.type === 'special');

        this.setData({
          originalGoodsData: {
            all: allGoods,
            spot: spotList,
            preorder: preorderList,
            special: specialList
          },
          goodsData: {
            all: allGoods,
            spot: spotList,
            preorder: preorderList,
            special: specialList
          }
        });
      } else {
        throw new Error(res.result?.message || '获取失败');
      }
    } catch (err) {
      console.error('加载商品失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.performSearch(keyword);
  },

  // 搜索确认
  onSearchConfirm(e) {
    const keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    this.performSearch(keyword);
  },

  // 执行搜索
  performSearch(keyword) {
    if (!keyword || keyword.trim() === '') {
      this.setData({
        goodsData: this.data.originalGoodsData
      });
      return;
    }

    const lowerKeyword = keyword.toLowerCase().trim();

    const filteredAll = this.data.originalGoodsData.all.filter(item =>
      item.name && item.name.toLowerCase().includes(lowerKeyword)
    );
    const filteredSpot = this.data.originalGoodsData.spot.filter(item =>
      item.name && item.name.toLowerCase().includes(lowerKeyword)
    );
    const filteredPreorder = this.data.originalGoodsData.preorder.filter(item =>
      item.name && item.name.toLowerCase().includes(lowerKeyword)
    );
    const filteredSpecial = this.data.originalGoodsData.special.filter(item =>
      item.name && item.name.toLowerCase().includes(lowerKeyword)
    );

    this.setData({
      goodsData: {
        all: filteredAll,
        spot: filteredSpot,
        preorder: filteredPreorder,
        special: filteredSpecial
      }
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  // 切换Tab
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 阻止事件冒泡
  stopPropagation() { },

  // 显示购物车详情
  showCartDetail() {
    this.setData({ showCartModal: true });
  },

  // 隐藏购物车详情
  hideCartDetail() {
    this.setData({ showCartModal: false });
  },

  // 从本地缓存加载购物车
  loadCartFromStorage() {
    const cart = wx.getStorageSync('shoppingCart') || [];
    this.updateCartData(cart);
    console.log('购物车数据已刷新，商品数量:', cart.length);
  },

  // 保存购物车到本地缓存
  saveCartToStorage(cart) {
    wx.setStorageSync('shoppingCart', cart);
  },

  // 更新商品列表中的购物车数量
  updateGoodsCartQuantity(goodsId) {
    const updatedGoodsData = JSON.parse(JSON.stringify(this.data.goodsData));
    const updatedOriginalData = JSON.parse(JSON.stringify(this.data.originalGoodsData));
    
    const updateQuantity = (goodsList) => {
      return goodsList.map(item => {
        const itemId = item.id || item.goodsId || item._id;
        if (itemId === goodsId) {
          const cartItem = this.data.cartList.find(cartItem => cartItem.id === goodsId);
          return {
            ...item,
            cartQuantity: cartItem ? cartItem.quantity : 0
          };
        }
        return item;
      });
    };
    
    // 更新所有商品类型的列表
    Object.keys(updatedGoodsData).forEach(key => {
      updatedGoodsData[key] = updateQuantity(updatedGoodsData[key]);
      updatedOriginalData[key] = updateQuantity(updatedOriginalData[key]);
    });
    
    this.setData({
      goodsData: updatedGoodsData,
      originalGoodsData: updatedOriginalData
    });
  },

  // 更新所有商品的购物车数量
  updateAllGoodsCartQuantity() {
    const updatedGoodsData = JSON.parse(JSON.stringify(this.data.goodsData));
    const updatedOriginalData = JSON.parse(JSON.stringify(this.data.originalGoodsData));
    
    const updateQuantity = (goodsList) => {
      return goodsList.map(item => {
        // 匹配商品 ID，使用与组件相同的逻辑
        const goodsId = item.id || item.goodsId || item._id;
        const cartItem = this.data.cartList.find(cartItem => cartItem.id === goodsId);
        return {
          ...item,
          cartQuantity: cartItem ? cartItem.quantity : 0
        };
      });
    };
    
    // 更新所有商品类型的列表
    Object.keys(updatedGoodsData).forEach(key => {
      updatedGoodsData[key] = updateQuantity(updatedGoodsData[key]);
      updatedOriginalData[key] = updateQuantity(updatedOriginalData[key]);
    });
    
    this.setData({
      goodsData: updatedGoodsData,
      originalGoodsData: updatedOriginalData
    });
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
    // 直接更新商品列表中的购物车数量，避免重新加载
    this.updateGoodsCartQuantity(id);
    wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
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
          // 直接更新商品列表中的购物车数量，避免重新加载
          this.updateGoodsCartQuantity(id);
          wx.showToast({ title: '已加入接龙', icon: 'success', duration: 1500 });
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
      // 直接更新商品列表中的购物车数量，避免重新加载
      this.updateGoodsCartQuantity(id);
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
        // 直接更新商品列表中的购物车数量，避免重新加载
        this.updateGoodsCartQuantity(id);
      } else {
        cart.splice(itemIndex, 1);
        this.updateCartData(cart);
        // 直接更新商品列表中的购物车数量，避免重新加载
        this.updateGoodsCartQuantity(id);
      }
    }
  },

  // 更新数量（从商品卡片组件触发）
  onUpdateQuantity(e) {
    const { id, quantity } = e.detail;
    let cart = [...this.data.cartList];
    const itemIndex = cart.findIndex(item => item.id === id);
    
    if (itemIndex !== -1) {
      cart[itemIndex].quantity += quantity;
      if (cart[itemIndex].quantity <= 0) {
        cart.splice(itemIndex, 1);
      }
    } else if (quantity > 0) {
      // 如果商品不在购物车中且是增加数量，则添加到购物车
      const goods = this.data.originalGoodsData.all.find(goods => goods.goodsId === id || goods._id === id);
      if (goods) {
        cart.push({
          id: goods.goodsId || goods._id,
          name: goods.name,
          price: goods.specialPrice || goods.price,
          image: goods.images && goods.images.length > 0 ? goods.images[0] : '',
          type: goods.type || 'spot',
          quantity: 1
        });
      }
    }
    
    this.updateCartData(cart);
    // 直接更新商品列表中的购物车数量，避免重新加载
    this.updateGoodsCartQuantity(id);
  },

  // 合并结算
  checkout() {
    console.log('=== 合并结算按钮被点击 ===');
    console.log('购物车商品数量:', this.data.cartList.length);
    console.log('购物车总价:', this.data.cartTotalPrice);

    if (this.data.cartList.length === 0) {
      wx.showToast({
        title: '购物车是空的',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    this.setData({ showCartModal: false });

    console.log('准备跳转到支付页面...');
    wx.navigateTo({
      url: '/pages/customer/checkout/checkout?total=' + this.data.cartTotalPrice,
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败', err);
        wx.showToast({
          title: '页面不存在',
          icon: 'none'
        });
      }
    });
  }
});