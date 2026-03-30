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
      // 页面显示时总是重新加载数据，确保获取最新状态
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
        console.log('获取取货码，openid:', openid)
        const res = await wx.cloud.callFunction({
          name: 'getPickupCode',
          data: { openid }
        })

        console.log('getPickupCode返回结果:', res)

        if (res && res.result && res.result.code === 0) {
          console.log('获取到取货码:', res.result.data.pickupCode)
          return res.result.data.pickupCode
        } else {
          console.error('获取取货码失败，错误信息:', res.result)
          throw new Error('获取取货码失败')
        }
      } catch (err) {
        console.error('获取取货码失败:', err)
        //  fallback: 如果云函数调用失败，使用本地生成作为备用
        const fallbackCode = this.generateFallbackCode(openid)
        console.log('使用备用取货码:', fallbackCode)
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

        // 优先从全局数据获取openid
        if (app.globalData.userInfo?.openid) {
          console.log('从全局数据获取openid:', app.globalData.userInfo.openid)
          resolve(app.globalData.userInfo.openid)
          return
        }

        // 调用云函数获取当前登录用户的openid
        wx.cloud.callFunction({
          name: 'getOpenId',
          success: res => {
            const openid = res.result.openid
            if (openid) {
              if (!app.globalData.userInfo) app.globalData.userInfo = {}
              app.globalData.userInfo.openid = openid
              console.log('从云函数获取openid:', openid)
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
        console.log('加载待取货订单，openid:', openid)
        const res = await wx.cloud.callFunction({
          name: 'getOrderList',
          data: {
            status: 'all',
            openid
          }
        })

        console.log('getOrderList返回结果:', res)

        if (res && res.result && res.result.code === 0) {
          const orders = res.result.data || []
          console.log('获取到的订单数量:', orders.length)
          // 提取未取货的商品（已到货或待到货）
          const allGoods = []
          let pickupCode = ''
          
          orders.forEach(order => {
            console.log('处理订单:', order._id)
            // 获取取货码
            if (order.pickupCode) {
              pickupCode = order.pickupCode
            }
            
            if (order.goods && order.goods.length > 0) {
              order.goods.forEach(goods => {
                // 只添加未取货的商品
                if (goods.pickupStatus !== '已取货' && goods.pickupStatus !== '已完成') {
                  // 处理商品图片，支持字符串和数组格式
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
                    pickupStatus: goods.pickupStatus || '待到货'
                  })
                }
              })
            }
          })

          console.log('提取的商品数量:', allGoods.length)
          console.log('获取到的取货码:', pickupCode)

          const statistics = {
            arrivedCount: allGoods.filter(item => item.pickupStatus === '已到货').length,
            waitingCount: allGoods.filter(item => item.pickupStatus === '待到货').length,
            totalCount: allGoods.length
          }

          console.log('统计数据:', statistics)

          // 生成二维码
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
