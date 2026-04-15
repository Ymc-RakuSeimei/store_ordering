// pages/customer/myOrder/components/waiting.js
Component({
  data: {
    pickupCode: '',
    orderList: [],
    statistics: null,
    loading: false,
    qrcodeUrl: ''
  },

  lifetimes: {
    attached() {
      this.loadData()
    }
  },

  pageLifetimes: {
    show() {
      if (!this.data.loading) {
        this.loadData()
      }
    }
  },

  methods: {
    async loadData() {
      this.setData({ loading: true })

      try {
        const openid = await this.getOpenid()
        await this.loadWaitingOrders(openid)
      } catch (err) {
        console.error('加载数据失败:', err)
      } finally {
        this.setData({ loading: false })
      }
    },

    async getPickupCode(openid) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getPickupCode',
          data: { openid }
        })

        if (res && res.result && res.result.code === 0) {
          return res.result.data.pickupCode
        } else {
          console.error('获取取货码失败，错误信息:', res.result)
          throw new Error('获取取货码失败')
        }
      } catch (err) {
        console.error('获取取货码失败:', err)
        const fallbackCode = this.generateFallbackCode(openid)
        return fallbackCode
      }
    },

    generateFallbackCode(openid) {
      let hash = 0
      for (let i = 0; i < openid.length; i++) {
        const char = openid.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      const code = Math.abs(hash) % 900000 + 100000
      return code.toString()
    },

    getOpenid() {
      return new Promise((resolve, reject) => {
        const app = getApp()

        if (app.globalData.userInfo?.openid) {
          resolve(app.globalData.userInfo.openid)
          return
        }

        wx.cloud.callFunction({
          name: 'getOpenId',
          success: res => {
            const openid = res.result.openid
            if (openid) {
              if (!app.globalData.userInfo) app.globalData.userInfo = {}
              app.globalData.userInfo.openid = openid
              resolve(openid)
            } else {
              reject(new Error('获取 openid 失败'))
            }
          },
          fail: (err) => {
            console.error('调用getOpenId云函数失败:', err)
            reject(new Error('获取 openid 失败'))
          }
        })
      })
    },

    generateQrcodeUrl(content) {
      try {
        const encodedContent = encodeURIComponent(content)
        const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodedContent}`
        this.setData({ qrcodeUrl })
      } catch (err) {
        console.error('生成二维码URL失败:', err)
      }
    },

    async loadWaitingOrders(openid) {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getOrderList',
          data: {
            status: 'all',
            openid
          }
        })

        if (res && res.result && res.result.code === 0) {
          const orders = res.result.data || []
          const allGoods = []
          let pickupCode = ''
          
          orders.forEach(order => {
            if (order.pickupCode) {
              pickupCode = order.pickupCode
            }
            
            if (order.goods && order.goods.length > 0) {
              order.goods.forEach(goods => {
                if (goods.pickupStatus !== '已取货' && goods.pickupStatus !== '已完成') {
                  let image = '';
                  if (goods.images) {
                    if (Array.isArray(goods.images) && goods.images.length > 0) {
                      image = goods.images[0];
                    } else if (typeof goods.images === 'string' && goods.images) {
                      image = goods.images;
                    }
                  }
                  
                  allGoods.push({
                    id: `${order._id}_${goods.goodsId}`,
                    image: image,
                    name: goods.name || '商品',
                    price: goods.price || 0,
                    quantity: goods.quantity || 1,
                    pickupStatus: goods.pickupStatus || '未到货'
                  })
                }
              })
            }
          })

          const statistics = {
            arrivedCount: allGoods.filter(item => item.pickupStatus === '待取货').length,
            waitingCount: allGoods.filter(item => item.pickupStatus === '未到货').length,
            totalCount: allGoods.length
          }

          if (pickupCode) {
            this.generateQrcodeUrl(pickupCode)
          }

          this.setData({
            orderList: allGoods,
            statistics,
            pickupCode
          })
        } else {
          console.error('getOrderList返回错误:', res.result)
        }
      } catch (err) {
        console.error('加载待取货订单失败:', err)
      }
    },

    refresh() {
      this.loadData()
    },

    copyCode() {
      if (!this.data.pickupCode) {
        wx.showToast({ title: '取货码未获取', icon: 'none' })
        return
      }
      wx.setClipboardData({
        data: this.data.pickupCode,
        success: () => wx.showToast({ title: '已复制', icon: 'success' }),
        fail: () => wx.showToast({ title: '复制失败', icon: 'none' })
      })
    }
  }
})