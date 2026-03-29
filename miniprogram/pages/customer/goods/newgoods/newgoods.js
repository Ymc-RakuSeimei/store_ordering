// pages/customer/goods/newgoods/newgoods.js
Page({
  data: {
    totalCount: 0,
    goodsList: [],
    showCartModal: false,
    cartList: [],
    cartTotalCount: 0,
    cartTotalPrice: 0
  },

  onLoad(options) {
    this.loadGoodsData()
    this.loadCartFromStorage()
  },

  // 加载商品数据（从云数据库）
  async loadGoodsData() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGoodsList',
        data: {
          category: '',      // 不筛选分类，获取全部
          page: 0,
          limit: 50,
          sortField: 'createdAt',
          sortOrder: 'desc'
        }
      })
      
      console.log('云函数返回:', res)
      
      if (res.result && res.result.code === 0) {
        const goodsList = this.formatGoodsData(res.result.data)
        this.setData({
          goodsList: goodsList,
          totalCount: res.result.total > 0 ? res.result.total : goodsList.length
        })
        console.log('格式化后的商品列表:', goodsList)
      } else {
        throw new Error(res.result?.message || '获取失败')
      }
    } catch (err) {
      console.error('加载商品失败', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 格式化商品数据，适配前端显示
  formatGoodsData(goodsList) {
    if (!goodsList || goodsList.length === 0) return []
    
    return goodsList.map(item => {
      // 根据商品类型设置不同的显示样式
      const isPreorder = item.type === 'preorder'
      const isSpot = item.type === 'spot' || item.type === 'special'
      
      // 图片处理：如果有图片数组且第一个有值，则使用；否则使用空字符串（不显示图片）
      let imageUrl = ''
      if (item.images && item.images.length > 0 && item.images[0]) {
        imageUrl = item.images[0]
      }
      // 如果图片是 "图一" 或 "图二" 这种示例文本，也视为无效
      if (imageUrl && (imageUrl === '图一' || imageUrl === '图二')) {
        imageUrl = ''
      }
      
      return {
        id: item._id,
        name: item.name || '商品名称',
        price: item.price || 0,
        // 状态文本：预定商品显示"已预定X件"，现货显示"库存剩余X件"
        statusText: isPreorder 
          ? `已预定${item.totalBooked || 0}件` 
          : `库存剩余${item.stock || 0}件`,
        spec: item.specs || '无规格',
        image: imageUrl,  // 没有图片时为空字符串
        // 角标
        badgeText: isPreorder ? '接龙预定' : (isSpot ? '现货订购' : ''),
        badgeClass: isPreorder ? 'preorder' : (isSpot ? 'spot' : ''),
        // 按钮文字和类型
        actionText: isPreorder ? '参与接龙' : '加入购物车',
        actionType: isPreorder ? 'joinGroup' : 'addToCart',
        type: item.type,
        // 原始数据
        rawData: item
      }
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 显示购物车详情
  showCartDetail() {
    this.setData({ showCartModal: true })
  },

  // 隐藏购物车详情
  hideCartDetail() {
    this.setData({ showCartModal: false })
  },

  // 从本地缓存加载购物车
  loadCartFromStorage() {
    const cart = wx.getStorageSync('shoppingCart') || []
    this.updateCartData(cart)
  },

  // 保存购物车到本地缓存
  saveCartToStorage(cart) {
    wx.setStorageSync('shoppingCart', cart)
  },

  // 更新购物车数据
  updateCartData(cart) {
    let totalCount = 0
    let totalPrice = 0
    cart.forEach(item => {
      totalCount += item.quantity
      totalPrice += item.price * item.quantity
    })
    this.setData({
      cartList: cart,
      cartTotalCount: totalCount,
      cartTotalPrice: totalPrice.toFixed(2)
    })
    this.saveCartToStorage(cart)
  },

  // 添加到购物车
  onAddToCart(e) {
    const { id, name, price, image, type } = e.detail
    const cart = [...this.data.cartList]
    const existingItem = cart.find(item => item.id === id)

    if (existingItem) {
      existingItem.quantity += 1
    } else {
      cart.push({
        id,
        name,
        price,
        image,
        type: type || 'spot',
        quantity: 1
      })
    }

    this.updateCartData(cart)
    wx.showToast({
      title: '已加入购物车',
      icon: 'success',
      duration: 1500
    })
  },

  // 参与接龙
  onJoinGroup(e) {
    const { id, name, price, image } = e.detail
    wx.showModal({
      title: '参与接龙',
      content: `确定要参与「${name}」的接龙预定吗？`,
      success: (res) => {
        if (res.confirm) {
          const cart = [...this.data.cartList]
          const existingItem = cart.find(item => item.id === id)

          if (existingItem) {
            existingItem.quantity += 1
          } else {
            cart.push({
              id,
              name,
              price,
              image,
              type: 'preorder',
              quantity: 1
            })
          }

          this.updateCartData(cart)
          wx.showToast({
            title: '已加入接龙',
            icon: 'success',
            duration: 1500
          })
        }
      }
    })
  },

  // 商品操作
  onAction(e) {
    const { item } = e.currentTarget.dataset
    if (item.actionType === 'addToCart') {
      this.onAddToCart({
        detail: {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          type: item.type
        }
      })
    } else if (item.actionType === 'joinGroup') {
      this.onJoinGroup({
        detail: {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image
        }
      })
    }
  },

  // 增加数量
  increaseQuantity(e) {
    const { id } = e.currentTarget.dataset
    const cart = [...this.data.cartList]
    const item = cart.find(item => item.id === id)
    if (item) {
      item.quantity += 1
      this.updateCartData(cart)
    }
  },

  // 减少数量
  decreaseQuantity(e) {
    const { id } = e.currentTarget.dataset
    let cart = [...this.data.cartList]
    const itemIndex = cart.findIndex(item => item.id === id)
    if (itemIndex !== -1) {
      if (cart[itemIndex].quantity > 1) {
        cart[itemIndex].quantity -= 1
        this.updateCartData(cart)
      } else {
        cart.splice(itemIndex, 1)
        this.updateCartData(cart)
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
      })
      return
    }

    this.setData({ showCartModal: false })

    wx.navigateTo({
      url: '/pages/customer/checkout/checkout?total=' + this.data.cartTotalPrice
    })
  }
})