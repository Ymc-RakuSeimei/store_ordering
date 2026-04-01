// 云函数 sendPickupReminder - 发送取货提醒
const cloud = require('wx-server-sdk')

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76'
cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const MAX_LIMIT = 100

// 分批获取所有订单
async function fetchAllOrders() {
  const result = []
  let skip = 0
  while (true) {
    const res = await db.collection('orders')
      .skip(skip)
      .limit(MAX_LIMIT)
      .get()
    const list = res.data || []
    result.push(...list)
    if (list.length < MAX_LIMIT) break
    skip += MAX_LIMIT
  }
  return result
}

exports.main = async (event, context) => {
  const { goodsId, goodsName, stock } = event

  if (!goodsId) {
    return { code: -1, message: '缺少商品ID' }
  }

  try {
    // 1. 查询 orders 表，找到包含该商品且商品状态为待取货的订单
    const orders = await fetchAllOrders()

    // 2. 筛选出包含该商品且商品 pickupStatus 为待取货的订单
    const targetOpenIds = new Set()
    const targetGoodsIdStr = String(goodsId).trim()

    orders.forEach(order => {
      const goods = order.goods || []
      const hasTargetGoods = goods.some(g => {
        const currentGoodsId = String(g.goodsId || '').trim()
        const currentGoodsDocId = String(g.goodsDocId || '').trim()
        // 同时匹配 goodsId 和 goodsDocId (_id)
        return (currentGoodsId === targetGoodsIdStr || currentGoodsDocId === targetGoodsIdStr)
          && g.pickupStatus === '待取货'
      })
      if (hasTargetGoods && order.openid) {
        targetOpenIds.add(order.openid)
      }
    })

    const openIdList = Array.from(targetOpenIds)

    if (openIdList.length === 0) {
      return { code: 0, userCount: 0, message: '没有需要提醒的顾客' }
    }

    // 3. 为每个用户插入消息记录
    const now = new Date()
    const insertPromises = openIdList.map(openid => {
      return db.collection('messages').add({
        data: {
          type: 'pickup',
          openid: openid,
          title: '商品到货提醒',
          content: `您购买的「${goodsName || '商品'}」已到货，请来取货！`,
          relatedData: {
            goodsId: goodsId,
            goodsName: goodsName || '',
            stock: stock || 0
          },
          isread: false,
          createAt: now
        }
      })
    })

    await Promise.all(insertPromises)

    return {
      code: 0,
      userCount: openIdList.length,
      message: `已提醒 ${openIdList.length} 位顾客`
    }
  } catch (err) {
    console.error('发送取货提醒失败', err)
    return { code: -1, message: err.message || '发送失败' }
  }
}
