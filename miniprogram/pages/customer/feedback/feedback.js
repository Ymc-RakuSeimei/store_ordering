// pages/customer/feedback/feedback.js
Page({
  data: {
    activeTab: 'afterSale',
    orders: [],
    orderIndex: -1,
    selectedOrder: null,
    goodsIndex: -1,
    selectedGoods: null,
    afterSaleOptions: [],
    afterSaleType: '',
    afterSaleReason: '',
    afterSaleImages: [],
    rating: 0,
    feedbackContent: '',
    feedbackImages: [],
    feedbackOrderIndex: -1,
    feedbackGoodsIndex: -1,
    feedbackSelectedGoods: null,
    submittedFeedbackOrders: {},
    userInfo: {},
    loading: false,
    submitLoading: false
  },

  onLoad(options) {
    this.getUserInfoAndOrders()
  },

  async getUserInfoAndOrders() {
    try {
      this.setData({ loading: true })
      const userRes = await wx.cloud.callFunction({
        name: 'getUserInfo'
      })
      
      if (userRes.result.success && userRes.result.user) {
        this.setData({ userInfo: userRes.result.user })
        await this.getOrderList(userRes.result.user.openid)
        await this.getSubmittedFeedbacks(userRes.result.user.openid)
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async getSubmittedFeedbacks(openid) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('feedbacks').where({
        openid: openid,
        type: '意见反馈'
      }).get()
      
      if (res.data) {
        const submittedOrderMap = {}
        res.data.forEach(item => {
          submittedOrderMap[item.orderId] = true
        })
        this.setData({ submittedFeedbackOrders: submittedOrderMap })
      }
    } catch (err) {
      console.error('获取已提交反馈失败', err)
    }
  },

  switchTab(e) {
    this.setData({
      activeTab: e.currentTarget.dataset.tab
    })
  },

  async getOrderList(openid) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getOrderList',
        data: { openid }
      })
      
      if (res.result && res.result.code === 0 && res.result.data) {
        this.setData({
          orders: res.result.data
        })
      } else {
        wx.showToast({ title: '获取订单失败', icon: 'none' })
      }
    } catch (err) {
      console.error('获取订单失败', err)
      wx.showToast({ title: '获取订单失败', icon: 'none' })
    }
  },

  bindOrderChange(e) {
    const index = parseInt(e.detail.value)
    const selectedOrder = this.data.orders[index]
    this.setData({
      orderIndex: index,
      selectedOrder: selectedOrder,
      goodsIndex: -1,
      selectedGoods: null,
      afterSaleType: '',
      afterSaleReason: '',
      afterSaleImages: []
    })
  },

  bindGoodsChange(e) {
    const index = parseInt(e.detail.value)
    const selectedOrder = this.data.selectedOrder
    const selectedGoods = selectedOrder.goods[index]
    this.setData({
      goodsIndex: index,
      selectedGoods: selectedGoods,
      afterSaleType: '',
      afterSaleReason: '',
      afterSaleImages: []
    })
    
    this.generateAfterSaleOptions(selectedGoods.pickupStatus)
  },

  generateAfterSaleOptions(status) {
    let options = []
    
    switch (status) {
      case '待取货':
        options = [
          { value: '仅退款', label: '仅退款' },
          { value: '更换货品', label: '更换货品' }
        ]
        break
      case '已取货':
        options = [
          { value: '仅退款', label: '仅退款' },
          { value: '退货退款', label: '退货退款' },
          { value: '更换货品', label: '更换货品' }
        ]
        break
      default:
        options = [
          { value: '取消订单', label: '取消订单' }
        ]
    }
    
    this.setData({ afterSaleOptions: options })
  },

  bindFeedbackOrderChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      feedbackOrderIndex: index,
      feedbackGoodsIndex: -1,
      feedbackSelectedGoods: null,
      rating: 0,
      feedbackContent: '',
      feedbackImages: []
    })
  },

  bindFeedbackGoodsChange(e) {
    const index = parseInt(e.detail.value)
    const selectedOrder = this.data.orders[this.data.feedbackOrderIndex]
    const feedbackSelectedGoods = selectedOrder.goods[index]
    this.setData({
      feedbackGoodsIndex: index,
      feedbackSelectedGoods: feedbackSelectedGoods
    })
  },

  bindAfterSaleTypeChange(e) {
    this.setData({ afterSaleType: e.detail.value })
  },

  bindAfterSaleReasonInput(e) {
    this.setData({ afterSaleReason: e.detail.value })
  },

  chooseAfterSaleImage() {
    const that = this
    wx.chooseImage({
      count: 9 - that.data.afterSaleImages.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePaths = res.tempFilePaths
        that.setData({
          afterSaleImages: that.data.afterSaleImages.concat(tempFilePaths)
        })
      }
    })
  },

  deleteAfterSaleImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.afterSaleImages
    images.splice(index, 1)
    this.setData({ afterSaleImages: images })
  },

  async submitAfterSale() {
    const { orderIndex, goodsIndex, orders, afterSaleType, afterSaleReason, afterSaleImages } = this.data
    
    if (orderIndex < 0) {
      wx.showToast({ title: '请选择订单', icon: 'none' })
      return
    }
    
    const selectedOrder = orders[orderIndex]
    
    if (goodsIndex < 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    
    const selectedGoods = selectedOrder.goods[goodsIndex]
    
    if (!afterSaleType) {
      wx.showToast({ title: '请选择售后类型', icon: 'none' })
      return
    }
    
    if (!afterSaleReason) {
      wx.showToast({ title: '请填写售后理由', icon: 'none' })
      return
    }
    
    if (afterSaleImages.length === 0) {
      wx.showToast({ title: '请上传售后图片', icon: 'none' })
      return
    }
    
    this.setData({ submitLoading: true })
    try {
      const uploadedImages = []
      for (const image of afterSaleImages) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `after_sale/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`,
          filePath: image
        })
        uploadedImages.push(uploadRes.fileID)
      }
      
      const res = await wx.cloud.callFunction({
        name: 'submitFeedback',
        data: {
          type: '售后申请',
          orderId: selectedOrder._id,
          orderNo: selectedOrder.orderNo,
          goodsId: selectedGoods.goodsId,
          goodsName: selectedGoods.name,
          afterSaleType,
          reason: afterSaleReason,
          images: uploadedImages
        }
      })
      
      if (res.result.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        this.setData({
          orderIndex: -1,
          selectedOrder: null,
          goodsIndex: -1,
          selectedGoods: null,
          afterSaleType: '',
          afterSaleReason: '',
          afterSaleImages: [],
          submitLoading: false
        })
      } else {
        this.setData({ submitLoading: false })
        wx.showToast({ title: '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('提交售后申请失败', err)
      this.setData({ submitLoading: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  },

  setRating(e) {
    this.setData({ rating: e.currentTarget.dataset.rating })
  },

  getStarIcon(index) {
    return index < this.data.rating ? '★' : '☆'
  },

  bindFeedbackContentInput(e) {
    this.setData({ feedbackContent: e.detail.value })
  },

  chooseFeedbackImage() {
    const that = this
    wx.chooseImage({
      count: 9 - that.data.feedbackImages.length,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePaths = res.tempFilePaths
        that.setData({
          feedbackImages: that.data.feedbackImages.concat(tempFilePaths)
        })
      }
    })
  },

  deleteFeedbackImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.feedbackImages
    images.splice(index, 1)
    this.setData({ feedbackImages: images })
  },

  async submitFeedback() {
    const { feedbackOrderIndex, feedbackGoodsIndex, orders, rating, feedbackContent, feedbackImages } = this.data

    if (feedbackOrderIndex < 0) {
      wx.showToast({ title: '请选择订单', icon: 'none' })
      return
    }

    const selectedOrder = orders[feedbackOrderIndex]

    if (feedbackGoodsIndex < 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }

    const selectedGoods = selectedOrder.goods[feedbackGoodsIndex]

    if (rating === 0) {
      wx.showToast({ title: '请进行评分', icon: 'none' })
      return
    }
    
    if (!feedbackContent) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    
    this.setData({ submitLoading: true })
    try {
      const uploadedImages = []
      for (const image of feedbackImages) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `feedback/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`,
          filePath: image
        })
        uploadedImages.push(uploadRes.fileID)
      }
      
      const res = await wx.cloud.callFunction({
        name: 'submitFeedback',
        data: {
          type: '意见反馈',
          orderId: selectedOrder._id,
          orderNo: selectedOrder.orderNo,
          goodsId: selectedGoods.goodsId,
          goodsName: selectedGoods.name,
          rating,
          content: feedbackContent,
          images: uploadedImages
        }
      })
      
      if (res.result.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        const submittedOrderMap = this.data.submittedFeedbackOrders
        submittedOrderMap[selectedOrder._id] = true
        this.setData({
          submittedFeedbackOrders: submittedOrderMap,
          feedbackOrderIndex: -1,
          feedbackGoodsIndex: -1,
          feedbackSelectedGoods: null,
          rating: 0,
          feedbackContent: '',
          feedbackImages: [],
          submitLoading: false
        })
      } else {
        this.setData({ submitLoading: false })
        wx.showToast({ title: res.result.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('提交反馈失败', err)
      this.setData({ submitLoading: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    }
  }
})