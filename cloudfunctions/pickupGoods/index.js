// cloudfunctions/pickupGoods/index.js
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { pickupCode, goodsIds } = event

    if (!pickupCode || !goodsIds || !Array.isArray(goodsIds)) {
      return {
        code: -1,
        message: '参数错误'
      }
    }

    console.log('开始处理取货，pickupCode:', pickupCode, 'goodsIds:', goodsIds)

    // 批量处理每个商品
    const updatePromises = goodsIds.map(async (goodsId) => {
      // 只按第一个下划线拆分，避免把 GD_xxx 这种 goodsId 截断成 GD
      const separatorIndex = typeof goodsId === 'string' ? goodsId.indexOf('_') : -1
      const orderId = separatorIndex > -1 ? goodsId.slice(0, separatorIndex) : ''
      const itemGoodsId = separatorIndex > -1 ? goodsId.slice(separatorIndex + 1) : ''

      if (!orderId || !itemGoodsId) {
        console.warn('无效的商品ID:', goodsId)
        return { success: false, goodsId, error: '无效的商品ID' }
      }

      console.log('处理商品，orderId:', orderId, 'itemGoodsId:', itemGoodsId)

      try {
        // 首先获取订单数据
        const orderRes = await db.collection('orders').doc(orderId).get()
        
        if (!orderRes.data) {
          console.warn('订单不存在:', orderId)
          return { success: false, goodsId, error: '订单不存在' }
        }

        const order = orderRes.data
        const goods = order.goods || []
        
        // 找到需要更新的商品索引
        const goodsIndex = goods.findIndex(item => item.goodsId === itemGoodsId)
        
        if (goodsIndex === -1) {
          console.warn('商品不在订单中:', itemGoodsId)
          return { success: false, goodsId, error: '商品不在订单中' }
        }

        // 检查商品状态
        if (goods[goodsIndex].pickupStatus === '已取货') {
          console.warn('商品已取货:', itemGoodsId)
          return { success: false, goodsId, error: '商品已取货' }
        }

        // 构建更新路径
        const pickupStatusPath = `goods.${goodsIndex}.pickupStatus`
        const pickuptimePath = `goods.${goodsIndex}.pickuptime`

        console.log('更新路径:', pickupStatusPath, '-> 已取货')

        // 更新订单中的商品状态
        const updateRes = await db.collection('orders').doc(orderId).update({
          data: {
            [pickupStatusPath]: '已取货',
            [pickuptimePath]: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })

        console.log('更新结果:', updateRes)

        if (updateRes.stats && updateRes.stats.updated > 0) {
          return { success: true, goodsId }
        } else {
          return { success: false, goodsId, error: '更新失败' }
        }
      } catch (err) {
        console.error('更新商品失败:', goodsId, err)
        return { success: false, goodsId, error: err.message }
      }
    })

    const results = await Promise.all(updatePromises)
    
    console.log('所有更新结果:', results)

    // 检查是否有失败的更新
    const failedItems = results.filter(r => !r.success)
    
    if (failedItems.length > 0) {
      console.warn('部分商品更新失败:', failedItems)
      // 如果有部分成功，仍然返回成功，但提示部分失败
      if (failedItems.length < results.length) {
        return {
          code: 0,
          message: `部分商品取货成功，${failedItems.length}个商品失败`,
          data: {
            success: results.filter(r => r.success).map(r => r.goodsId),
            failed: failedItems
          }
        }
      } else {
        return {
          code: -1,
          message: '取货失败: ' + (failedItems[0].error || '未知错误'),
          data: { failed: failedItems }
        }
      }
    }

    return {
      code: 0,
      message: '取货成功',
      data: {
        success: results.filter(r => r.success).map(r => r.goodsId)
      }
    }

  } catch (err) {
    console.error('取货失败:', err)
    return {
      code: -1,
      message: '取货失败: ' + (err.message || '未知错误')
    }
  }
}
