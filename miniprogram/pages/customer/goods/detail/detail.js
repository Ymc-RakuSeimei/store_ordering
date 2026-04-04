// pages/customer/goods/detail/detail.js
Page({
  data: {
    goodsDetail: {},
    quantity: 1
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
  },

  // 获取商品详情
  async getGoodsDetail(id) {
    wx.showLoading({ title: '加载中...' });
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
        this.setData({ goodsDetail });
      } else {
        throw new Error(res.result?.message || '获取商品详情失败');
      }
    } catch (err) {
      console.error('获取商品详情失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 格式化商品详情数据
  formatGoodsDetail(item) {
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
    
    return {
      id: item.goodsId || item._id,
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
      type: item.type,
      description: item.description
    };
  },

  // 减少数量
  decreaseQuantity() {
    if (this.data.quantity > 1) {
      this.setData({
        quantity: this.data.quantity - 1
      });
    }
  },

  // 增加数量
  increaseQuantity() {
    this.setData({
      quantity: this.data.quantity + 1
    });
  },

  // 加入购物车
  addToCart() {
    const { goodsDetail, quantity } = this.data;
    const cart = wx.getStorageSync('shoppingCart') || [];
    const existingItem = cart.find(item => item.id === goodsDetail.id);

    if (existingItem) {
      existingItem.quantity += quantity;
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
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});