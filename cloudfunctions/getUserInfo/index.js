const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { role, store } = event

  console.log('getUserInfo参数:', { role, store, openid })

  try {
    if (role === 'merchant') {
      // 先尝试按店名查询
      let merchantUser = null
      
      if (store) {
        let whereCondition = { role: 'merchant', storeName: store }
        const merchantRes = await db.collection('users').where(whereCondition).get()
        console.log('按店名查询条件:', whereCondition)
        console.log('按店名查询结果:', merchantRes)
        
        if (merchantRes.data.length > 0) {
          merchantUser = merchantRes.data[0]
        }
      }
      
      // 如果没有找到，返回任意一个商家
      if (!merchantUser) {
        console.log('未找到指定店名的商家，返回任意商家')
        const allMerchantRes = await db.collection('users').where({ role: 'merchant' }).get()
        console.log('所有商家查询结果:', allMerchantRes)
        
        if (allMerchantRes.data.length > 0) {
          merchantUser = allMerchantRes.data[0]
        }
      }
      
      if (merchantUser) {
        console.log('返回的商家:', merchantUser)
        return {
          success: true,
          user: merchantUser
        }
      } else {
        return {
          success: false,
          error: '未找到商家信息'
        }
      }
    } else {
      // 获取当前用户信息
      const userRes = await db.collection('users').where({ openid }).get()
      if (userRes.data.length > 0) {
        return {
          success: true,
          user: userRes.data[0]
        }
      } else {
        return {
          success: true,
          user: null,
          openid: openid
        }
      }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}