// 云函数 fetchGoodsList - 获取商品列表
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const res = await db.collection('goods').get()
    return {
      code: 0,
      data: res.data || []
    }
  } catch (err) {
    console.error('获取商品列表失败', err)
    return {
      code: -1,
      message: err.message || '获取失败'
    }
  }
}
