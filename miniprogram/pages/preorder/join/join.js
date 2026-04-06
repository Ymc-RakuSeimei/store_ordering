// pages/preorder/join/join.js
const app = getApp();

Page({
  data: {
    dragonId: '',
    dragon: null,
    loading: true,
    submitting: false,
    quantity: 1,
    remark: '',
    hasJoined: false,
    myParticipation: null,
    error: ''
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '参与接龙' });

    if (!options.id) {
      this.setData({ error: '链接无效', loading: false });
      return;
    }

    this.setData({ dragonId: options.id });
    this.authAndLoad();
  },

  /**
   * 身份验证并加载数据
   */
  async authAndLoad() {
    try {
      wx.showLoading({ title: '验证中...' });

      await app.getUserRole();

      wx.hideLoading();
      this.loadDragonDetail();
    } catch (err) {
      wx.hideLoading();
      console.error('身份验证失败', err);
      this.setData({ error: '身份验证失败，请重试', loading: false });
    }
  },

  /**
   * 加载接龙详情
   */
  async loadDragonDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const dragonId = this.data.dragonId;
      
      // 调用 getGoodsDetail 获取商品基本信息
      const goodsRes = await wx.cloud.callFunction({
        name: 'getGoodsDetail',
        data: { goodsId: dragonId }
      });

      if (!goodsRes.result || goodsRes.result.code !== 0) {
        throw new Error(goodsRes.result?.message || '获取商品信息失败');
      }

      const goods = goodsRes.result.data;
      
      if (goods.type !== 'preorder') {
        throw new Error('商品类型错误');
      }

      // 获取当前用户的 openid，判断是否已参与
      let openid = '';
      let myParticipation = null;
      try {
        const openidRes = await wx.cloud.callFunction({ name: 'getOpenId' });
        openid = openidRes.result.openid;
        
        // 查询用户是否已参与此接龙
        const preorderRes = await wx.cloud.callFunction({
          name: 'fetchPreorderDetail',
          data: { dragonId: dragonId }
        });
        
        if (preorderRes.result && preorderRes.result.code === 0) {
          const participants = preorderRes.result.data.participants || [];
          myParticipation = participants.find(p => p.userId === openid);
        }
      } catch (err) {
        console.log('获取参与记录失败', err);
      }

      // 组装接龙商品数据
      const dragon = {
        id: goods.goodsId || goods._id,
        name: goods.name || '接龙商品',
        spec: goods.specs || '无规格',
        salePrice: goods.price || 0,
        img: goods.images && goods.images[0] ? goods.images[0] : '',
        limitPerPerson: goods.limitPerPerson || 0,
        arrivalDate: goods.arrivalDate || '',
        totalBooked: goods.totalBooked || 0,
        status: goods.preorderState === 'ongoing' ? 'ongoing' : 'completed',
        description: goods.description || ''
      };

      this.setData({
        dragon: dragon,
        loading: false,
        hasJoined: !!myParticipation,
        myParticipation: myParticipation || null
      });
    } catch (err) {
      console.error('加载详情失败', err);
      this.setData({ error: err.message || '加载失败，请重试', loading: false });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 减少数量
   */
  onDecreaseQty() {
    if (this.data.quantity > 1) {
      this.setData({ quantity: this.data.quantity - 1 });
    }
  },

  /**
   * 增加数量
   */
  onIncreaseQty() {
    const { quantity, dragon } = this.data;
    if (dragon.limitPerPerson > 0 && quantity >= dragon.limitPerPerson) {
      wx.showToast({ title: `每人限购${dragon.limitPerPerson}件`, icon: 'none' });
      return;
    }
    this.setData({ quantity: quantity + 1 });
  },

  /**
   * 手动输入数量
   */
  onQtyInput(e) {
    let qty = parseInt(e.detail.value) || 1;
    const { dragon } = this.data;
    if (dragon.limitPerPerson > 0 && qty > dragon.limitPerPerson) {
      qty = dragon.limitPerPerson;
      wx.showToast({ title: `每人限购${dragon.limitPerPerson}件`, icon: 'none' });
    }
    if (qty < 1) qty = 1;
    this.setData({ quantity: qty });
  },

  /**
   * 输入备注
   */
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  /**
   * 提交参与（添加到购物车）
   */
  onSubmit() {
    if (this.data.submitting) return;
    if (this.data.quantity < 1) {
      wx.showToast({ title: '请填写数量', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认参与',
      content: `参与 "${this.data.dragon.name}"\n数量：${this.data.quantity} 份`,
      success: (res) => {
        if (res.confirm) {
          this.doSubmit();
        }
      }
    });
  },

  /**
   * 执行提交（添加到购物车）
   */
  async doSubmit() {
    this.setData({ submitting: true });
    wx.showLoading({ title: '处理中...' });

    try {
      const { dragon, quantity, remark } = this.data;
      
      const cart = wx.getStorageSync('shoppingCart') || [];
      const existingItem = cart.find(item => item.id === dragon.id);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({
          id: dragon.id,
          name: dragon.name,
          price: dragon.salePrice,
          image: dragon.img,
          type: 'preorder',
          quantity: quantity,
          remark: remark
        });
      }

      wx.setStorageSync('shoppingCart', cart);
      
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '已加入接龙', icon: 'success' });

      setTimeout(() => {
        this.loadDragonDetail();
      }, 500);
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ submitting: false });
      console.error('提交失败', err);
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});