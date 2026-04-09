// pages/merchant/verify/verify.js
Page({
  data: {
    pickupCode: '',           // 取货码
    customerInfo: null,         // 顾客信息
    pickupGoods: [],            // 可取货商品
    waitingGoods: [],           // 待到货商品
    loading: true,
    pickupLoading: false,
    errorMsg: ''
  },

  onLoad(options) {
    const { code } = options
    if (!code) {
      this.setData({
        loading: false,
        errorMsg: '未获取到取货码'
      })
      return
    }

    this.setData({ pickupCode: code })
    this.loadCustomerOrders(code)
  },

  // 加载顾客订单
  async loadCustomerOrders(pickupCode) {
    try {
      this.setData({ loading: true })

      // 调用云函数获取顾客未取货物
      const res = await wx.cloud.callFunction({
        name: 'getCustomerPendingGoods',
        data: { pickupCode }
      })

      if (res.result && res.result.code === 0) {
        const { customerInfo, pickupGoods, waitingGoods } = res.result.data
        this.setData({
          customerInfo,
          pickupGoods: pickupGoods || [],
          waitingGoods: waitingGoods || [],
          loading: false
        })
      } else {
        this.setData({
          loading: false,
          errorMsg: res.result.message || '获取订单失败'
        })
      }
    } catch (err) {
      console.error('加载顾客订单失败:', err)
      this.setData({
        loading: false,
        errorMsg: '加载失败，请重试'
      })
    }
  },

  // 单个取货
  onPickupItem(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '确认取货',
      content: '确认该商品已取货？',
      success: (res) => {
        if (res.confirm) {
          this.pickupGoods([id])
        }
      }
    })
  },

  // 一键取货
  onPickupAll() {
    const { pickupGoods } = this.data
    if (pickupGoods.length === 0) {
      wx.showToast({ title: '没有可取货商品', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认一键取货',
      content: `确认取走全部 ${pickupGoods.length} 件商品？`,
      success: (res) => {
        if (res.confirm) {
          const ids = pickupGoods.map(item => item.id)
          this.pickupGoods(ids)
        }
      }
    })
  },

  // 调用云函数核销商品
  async pickupGoods(goodsIds) {
    try {
      this.setData({ pickupLoading: true })

      const res = await wx.cloud.callFunction({
        name: 'pickupGoods',
        data: {
          pickupCode: this.data.pickupCode,
          goodsIds
        }
      })

      this.setData({ pickupLoading: false })

      if (res.result && res.result.code === 0) {
        wx.showToast({ title: '取货成功', icon: 'success' })
        // 刷新数据
        this.loadCustomerOrders(this.data.pickupCode)
      } else {
        wx.showToast({
          title: res.result.message || '取货失败',
          icon: 'none'
        })
      }
    } catch (err) {
      this.setData({ pickupLoading: false })
      console.error('取货失败:', err)
      wx.showToast({ title: '取货失败', icon: 'none' })
    }
  },



  // 重新加载
  onRetry() {
    this.loadCustomerOrders(this.data.pickupCode)
  }
})
