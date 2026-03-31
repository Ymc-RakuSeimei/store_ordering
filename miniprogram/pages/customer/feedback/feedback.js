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
    submittedFeedbackOrders: [], // 已提交反馈的订单ID列表
    userInfo: {}
  },

  onLoad(options) {
    this.getUserInfoAndOrders()
  },

  // 获取用户信息和订单
  async getUserInfoAndOrders() {
    try {
      wx.hideLoading()
    } catch (e) {}
    wx.showLoading({ title: '加载中...' })
    try {
      // 先获取用户信息
      const userRes = await wx.cloud.callFunction({
        name: 'getUserInfo'
      })
      
      if (userRes.result.success && userRes.result.user) {
        this.setData({ userInfo: userRes.result.user })
        // 然后获取订单
        await this.getOrderList(userRes.result.user.openid)
        // 获取已提交反馈的订单列表
        await this.getSubmittedFeedbacks(userRes.result.user.openid)
      }
    } catch (err) {
      console.error('获取用户信息失败', err)
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {}
    }
  },

  // 获取已提交反馈的订单
  async getSubmittedFeedbacks(openid) {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('feedbacks').where({
        openid: openid,
        type: '意见反馈'
      }).get()
      
      if (res.data) {
        // 使用对象来存储，方便wxml中快速查找
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

  // 切换选项卡
  switchTab(e) {
    this.setData({
      activeTab: e.currentTarget.dataset.tab
    })
  },

  // 获取订单列表
  async getOrderList(openid) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getOrderList',
        data: { openid }
      })
      
      console.log('getOrderList返回结果:', res)
      
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

  // 订单选择变化
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

  // 商品选择变化
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
    
    // 根据商品取货状态生成售后选项
    this.generateAfterSaleOptions(selectedGoods.pickupStatus)
  },

  // 根据订单状态生成售后选项
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
        // 未到货状态
        options = [
          { value: '取消订单', label: '取消订单' }
        ]
    }
    
    this.setData({ afterSaleOptions: options })
  },

  // 反馈订单选择变化
  bindFeedbackOrderChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      feedbackOrderIndex: index,
      rating: 0,
      feedbackContent: '',
      feedbackImages: []
    })
  },

  // 售后类型选择
  bindAfterSaleTypeChange(e) {
    this.setData({ afterSaleType: e.detail.value })
  },

  // 售后理由输入
  bindAfterSaleReasonInput(e) {
    this.setData({ afterSaleReason: e.detail.value })
  },

  // 选择售后图片
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

  // 删除售后图片
  deleteAfterSaleImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.afterSaleImages
    images.splice(index, 1)
    this.setData({ afterSaleImages: images })
  },

  // 提交售后申请
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
    
    try {
      wx.hideLoading()
    } catch (e) {}
    wx.showLoading({ title: '提交中...' })
    try {
      // 上传图片
      const uploadedImages = []
      for (const image of afterSaleImages) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `after_sale/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`,
          filePath: image
        })
        uploadedImages.push(uploadRes.fileID)
      }
      
      // 提交售后申请
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
        // 重置表单
        this.setData({
          orderIndex: -1,
          selectedOrder: null,
          goodsIndex: -1,
          selectedGoods: null,
          afterSaleType: '',
          afterSaleReason: '',
          afterSaleImages: []
        })
      } else {
        wx.showToast({ title: '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('提交售后申请失败', err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {}
    }
  },

  // 设置评分
  setRating(e) {
    this.setData({ rating: e.currentTarget.dataset.rating })
  },

  // 获取星星图标
  getStarIcon(index) {
    return index < this.data.rating ? '★' : '☆'
  },

  // 反馈内容输入
  bindFeedbackContentInput(e) {
    this.setData({ feedbackContent: e.detail.value })
  },

  // 选择反馈图片
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

  // 删除反馈图片
  deleteFeedbackImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.feedbackImages
    images.splice(index, 1)
    this.setData({ feedbackImages: images })
  },

  // 提交反馈
  async submitFeedback() {
    const { feedbackOrderIndex, orders, rating, feedbackContent, feedbackImages } = this.data
    
    if (feedbackOrderIndex < 0) {
      wx.showToast({ title: '请选择订单', icon: 'none' })
      return
    }
    
    const selectedOrder = orders[feedbackOrderIndex]
    
    if (rating === 0) {
      wx.showToast({ title: '请进行评分', icon: 'none' })
      return
    }
    
    if (!feedbackContent) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    
    try {
      wx.hideLoading()
    } catch (e) {}
    wx.showLoading({ title: '提交中...' })
    try {
      // 上传图片
      const uploadedImages = []
      for (const image of feedbackImages) {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `feedback/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`,
          filePath: image
        })
        uploadedImages.push(uploadRes.fileID)
      }
      
      // 提交反馈
      const res = await wx.cloud.callFunction({
        name: 'submitFeedback',
        data: {
          type: '意见反馈',
          orderId: selectedOrder._id,
          orderNo: selectedOrder.orderNo,
          rating,
          content: feedbackContent,
          images: uploadedImages
        }
      })
      
      if (res.result.success) {
        wx.showToast({ title: '提交成功', icon: 'success' })
        // 更新已提交反馈的订单列表
        const submittedOrderMap = this.data.submittedFeedbackOrders
        submittedOrderMap[selectedOrder._id] = true
        this.setData({
          submittedFeedbackOrders: submittedOrderMap,
          feedbackOrderIndex: -1,
          rating: 0,
          feedbackContent: '',
          feedbackImages: []
        })
      } else {
        wx.showToast({ title: res.result.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('提交反馈失败', err)
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      try {
        wx.hideLoading()
      } catch (e) {}
    }
  }
})
