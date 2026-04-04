// cloudfunctions/getCustomerPendingGoods/index.js
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { pickupCode } = event

    if (!pickupCode) {
      return {
        code: -1,
        message: '取货码不能为空'
      }
    }

    // 首先通过取货码查询对应的openid
    let openid = null
    try {
      const pickupCodeResult = await cloud.callFunction({
        name: 'getPickupCode',
        data: { pickupCode }
      })

      if (pickupCodeResult && pickupCodeResult.result && pickupCodeResult.result.code === 0) {
        openid = pickupCodeResult.result.data.openid
      }
    } catch (err) {
      console.error('查询取货码对应openid失败:', err)
    }

    // 查询条件：优先使用openid，其次使用pickupCode
    const filter = {
      status: '待取货'
    }

    if (openid) {
      filter.openid = openid
    } else {
      filter.pickupCode = pickupCode
    }

    // 查询待处理订单
    const orders = await db.collection('orders')
      .where(filter)
      .get()

    // 如果使用openid查询，可能需要进一步筛选pickupCode
    const filteredOrders = openid ?
      orders.data.filter(order => order.pickupCode === pickupCode) :
      orders.data

    // 如果没有找到，返回空数据
    if (filteredOrders.length === 0) {
      return {
        code: 0,
        data: {
          customerInfo: {
            name: '顾客',
            phone: ''
          },
          pickupGoods: [],
          waitingGoods: []
        }
      }
    }

    const pickupGoods = []
    const waitingGoods = []
    let customerInfo = {
      name: '顾客',
      phone: ''
    }

    filteredOrders.forEach(order => {
      // 获取顾客信息
      if (order.customerInfo) {
        customerInfo = {
          name: order.customerInfo.name || '顾客',
          phone: order.customerInfo.phone || ''
        }
      }

      // 处理订单中的商品
      if (order.goods && Array.isArray(order.goods)) {
        order.goods.forEach((item, index) => {
          // 确保goodsId存在，使用索引作为备用
          const goodsId = item.goodsId || index

          const goodsItem = {
            id: `${order._id}_${goodsId}`,
            orderId: order._id,
            goodsId: goodsId,
            name: item.name || '商品',
            quantity: item.quantity || 1,
            price: item.price || 0,
            image: item.images?.[0] || item.image || 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png'
          }

          // 根据状态分类
          if (item.pickupStatus === '待取货') {
            pickupGoods.push(goodsItem)
          } else if (item.pickupStatus === '未到货') {
            waitingGoods.push(goodsItem)
          }
          // 已取货的商品不显示
        })
      }
    })

    return {
      code: 0,
      data: {
        customerInfo,
        pickupGoods,
        waitingGoods
      }
    }

  } catch (err) {
    console.error('查询顾客未取货物失败:', err)
    return {
      code: -1,
      message: '查询失败: ' + (err.message || '未知错误')
    }
  }
}