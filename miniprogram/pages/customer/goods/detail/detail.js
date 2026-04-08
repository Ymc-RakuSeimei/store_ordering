// pages/customer/goods/detail/detail.js
Page({
  data: {
    goodsDetail: null,
    quantity: 1,
    cartCount: 0,
    cartTotal: '0.00',
    isAdding: false,
    loading: true
  },

  onLoad(options) {
    console.log('onLoad options:', options);
    const { id } = options;
    console.log('onLoad id:', id);
    if (id) {
      this.getGoodsDetail(id);
    } else {
      console.error('缺少商品ID');
      wx.showToast({ title: '缺少商品信息', icon: 'none' });
    }
    this.loadCartInfo();
  },

  onShow() {
    // 每次显示页面时刷新购物车信息
    this.loadCartInfo();
    // 同步购物车中的商品数量
    this.syncQuantityFromCart();
  },

  // 从购物车同步商品数量
  syncQuantityFromCart() {
    const { goodsDetail } = this.data;
    if (!goodsDetail) return;
    
    const cart = wx.getStorageSync('shoppingCart') || [];
    const cartItem = cart.find(item => item.id === goodsDetail.id);
    if (cartItem) {
      this.setData({ quantity: cartItem.quantity });
    }
  },

  // 获取商品详情
  async getGoodsDetail(id) {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGoodsDetail',
        data: {
          goodsId: id
        }
      });

      if (res.result && res.result.code === 0) {
        const goods = res.result.data;
        const goodsDetail = this.formatGoodsDetail(goods);
        
        // 从购物车获取该商品已有的数量
        const cart = wx.getStorageSync('shoppingCart') || [];
        const cartItem = cart.find(item => item.id === goodsDetail.id);
        const quantity = cartItem ? cartItem.quantity : 0;
        
        this.setData({ goodsDetail, quantity, loading: false });
      } else {
        throw new Error(res.result?.message || '获取商品详情失败');
      }
    } catch (err) {
      console.error('获取商品详情失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      // 不需要 wx.hideLoading()，因为我们使用的是自定义加载状态
    }
  },

  // 格式化商品详情数据
  formatGoodsDetail(item) {
    const isSpot = item.type === 'spot';
    const isSpecial = item.type === 'special';
    
    // 处理图片
    let imageUrl = '';
    if (item.images && item.images.length > 0) {
      const validImages = item.images.filter(img => img && img !== '图一' && img !== '图二');
      if (validImages.length > 0) {
        imageUrl = validImages[0];
      }
    }
    
    // 计算库存状态
    const stock = item.stock || 0;
    const remainingStock = stock;
    
    return {
      id: item.goodsId || item._id,
      name: item.name || '商品名称',
      price: isSpecial ? (item.specialPrice || item.price) : item.price,
      originalPrice: isSpecial ? item.price : null,
      statusLabel: '库存剩余',
      statusText: `${remainingStock}件`,
      statusClass: remainingStock < 10 ? 'stock-low' : '',
      spec: item.specs || '无规格',
      image: imageUrl,
      badgeText: isSpecial ? '特价处理' : '现货订购',
      badgeClass: isSpecial ? 'special' : 'spot',
      priceClass: isSpecial ? 'special-price' : '',
      type: item.type,
      description: item.description,
      stock: remainingStock
    };
  },

  // 加载购物车信息
  loadCartInfo() {
    const cart = wx.getStorageSync('shoppingCart') || [];
    const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0).toFixed(2);
    
    this.setData({
      cartCount,
      cartTotal
    });
  },

  // 减少数量
  decreaseQuantity() {
    const newQuantity = this.data.quantity - 1;
    if (newQuantity < 0) return;
    this.setData({ quantity: newQuantity });
    this.updateCartQuantity(newQuantity);
  },

  // 增加数量
  increaseQuantity() {
    const { goodsDetail, quantity } = this.data;
    // 检查库存限制
    if (goodsDetail.stock && quantity >= goodsDetail.stock) {
      wx.showToast({ title: '已达到最大库存', icon: 'none' });
      return;
    }
    const newQuantity = quantity + 1;
    this.setData({ quantity: newQuantity });
    this.updateCartQuantity(newQuantity);
  },

  // 手动输入数量
  onQtyInput(e) {
    let qty = parseInt(e.detail.value) || 0;
    const { goodsDetail } = this.data;
    if (goodsDetail.stock && qty > goodsDetail.stock) {
      qty = goodsDetail.stock;
      wx.showToast({ title: '已达到最大库存', icon: 'none' });
    }
    this.setData({ quantity: qty });
    this.updateCartQuantity(qty);
  },

  // 更新购物车中的商品数量
  updateCartQuantity(newQuantity) {
    const { goodsDetail } = this.data;
    let cart = wx.getStorageSync('shoppingCart') || [];
    const existingItemIndex = cart.findIndex(item => item.id === goodsDetail.id);

    if (existingItemIndex !== -1) {
      if (newQuantity <= 0) {
        // 数量为0时从购物车移除
        cart.splice(existingItemIndex, 1);
      } else {
        cart[existingItemIndex].quantity = newQuantity;
      }
    } else if (newQuantity > 0) {
      // 如果商品还没有加入购物车且数量大于0，则添加到购物车
      cart.push({
        id: goodsDetail.id,
        name: goodsDetail.name,
        price: goodsDetail.price,
        image: goodsDetail.image,
        type: goodsDetail.type || 'spot',
        quantity: newQuantity
      });
    }
    wx.setStorageSync('shoppingCart', cart);
    this.loadCartInfo();
  },

  // 加入购物车
  addToCart() {
    const { goodsDetail, quantity } = this.data;
    const cart = wx.getStorageSync('shoppingCart') || [];
    const existingItem = cart.find(item => item.id === goodsDetail.id);

    if (existingItem) {
      // 直接设置数量而不是累加
      existingItem.quantity = quantity;
    } else {
      cart.push({
        id: goodsDetail.id,
        name: goodsDetail.name,
        price: goodsDetail.price,
        image: goodsDetail.image,
        type: goodsDetail.type || 'spot',
        quantity: quantity
      });
    }

    wx.setStorageSync('shoppingCart', cart);
    
    // 显示添加成功状态
    this.setData({ isAdding: true });
    setTimeout(() => {
      this.setData({ isAdding: false });
    }, 1500);
    
    // 刷新购物车信息
    this.loadCartInfo();
    
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  // 跳转到购物车
  goToCart() {
    wx.navigateBack({
      success: () => {
        // 返回商品列表页后，可以触发显示购物车弹窗
        const pages = getCurrentPages();
        if (pages.length > 0) {
          const currentPage = pages[pages.length - 1];
          if (currentPage && currentPage.showCartModal) {
            currentPage.showCartModal();
          }
        }
      }
    });
  },

});
