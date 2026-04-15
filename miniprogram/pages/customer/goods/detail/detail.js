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
    const { id } = options;
    if (id) {
      this.getGoodsDetail(id);
    } else {
      console.error('缺少商品ID');
      wx.showToast({ title: '缺少商品信息', icon: 'none' });
    }
    this.loadCartInfo();
  },

  onShow() {
    this.loadCartInfo();
    this.syncQuantityFromCart();
  },

  syncQuantityFromCart() {
    const { goodsDetail } = this.data;
    if (!goodsDetail) return;
    
    const cart = wx.getStorageSync('shoppingCart') || [];
    const cartItem = cart.find(item => item.id === goodsDetail.id);
    if (cartItem) {
      this.setData({ quantity: cartItem.quantity });
    }
  },

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
    }
  },

  formatGoodsDetail(item) {
    const isSpot = item.type === 'spot';
    const isSpecial = item.type === 'special';
    
    let imageUrl = '';
    if (item.images && item.images.length > 0) {
      const validImages = item.images.filter(img => img && img !== '图一' && img !== '图二');
      if (validImages.length > 0) {
        imageUrl = validImages[0];
      }
    }
    
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

  loadCartInfo() {
    const cart = wx.getStorageSync('shoppingCart') || [];
    const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const cartTotal = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0).toFixed(2);
    
    this.setData({
      cartCount,
      cartTotal
    });
  },

  decreaseQuantity() {
    const newQuantity = this.data.quantity - 1;
    if (newQuantity < 0) return;
    this.setData({ quantity: newQuantity });
    this.updateCartQuantity(newQuantity);
  },

  increaseQuantity() {
    const { goodsDetail, quantity } = this.data;
    if (goodsDetail.stock && quantity >= goodsDetail.stock) {
      wx.showToast({ title: '已达到最大库存', icon: 'none' });
      return;
    }
    const newQuantity = quantity + 1;
    this.setData({ quantity: newQuantity });
    this.updateCartQuantity(newQuantity);
  },

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

  updateCartQuantity(newQuantity) {
    const { goodsDetail } = this.data;
    let cart = wx.getStorageSync('shoppingCart') || [];
    const existingItemIndex = cart.findIndex(item => item.id === goodsDetail.id);

    if (existingItemIndex !== -1) {
      if (newQuantity <= 0) {
        cart.splice(existingItemIndex, 1);
      } else {
        cart[existingItemIndex].quantity = newQuantity;
      }
    } else if (newQuantity > 0) {
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

  addToCart() {
    const { goodsDetail, quantity } = this.data;
    const cart = wx.getStorageSync('shoppingCart') || [];
    const existingItem = cart.find(item => item.id === goodsDetail.id);

    if (existingItem) {
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
    
    this.setData({ isAdding: true });
    setTimeout(() => {
      this.setData({ isAdding: false });
    }, 1500);
    
    this.loadCartInfo();
    
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  goToCart() {
    wx.navigateBack({
      success: () => {
        const pages = getCurrentPages();
        if (pages.length > 0) {
          const currentPage = pages[pages.length - 1];
          if (currentPage && currentPage.showCartModal) {
            currentPage.showCartModal();
          }
        }
      }
    });
  }
});