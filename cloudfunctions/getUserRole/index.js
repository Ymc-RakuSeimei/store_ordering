// 云函数 getUserRole
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

// 开发测试白名单
const DEVELOPER_OPENIDS = ['oqClo15h3ZO3ZZ5h30s6vUcpYBMI', 'oqClo1zp-lntsO0ghtMPr7b8L4HA', 'oqClo14495w0vH3m1H3OPtWdJStA', 'oqClo182WJ4T9t6bP_X0SzL3crSc'] 

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 查询用户是否存在
  let user = null
  try {
    const res = await db.collection('users').where({ openid }).get()
    if (res.data.length > 0) user = res.data[0]
  } catch (err) {
    console.error('查询用户失败', err)
    return { code: -1, message: '查询失败' }
  }

  // 生成6位数字取货码
  function generateSixDigitCode(openid) {
    let hash = 0
    for (let i = 0; i < openid.length; i++) {
      const char = openid.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    const code = Math.abs(hash) % 900000 + 100000
    return code.toString()
  }

  // 自动注册
  if (!user) {
    const { nickName = '微信用户', avatarUrl = '' } = event.userInfo || {}
    try {
      const pickupCode = generateSixDigitCode(openid)
      const addRes = await db.collection('users').add({
        data: {
          openid,
          nickName,
          avatarUrl,
          role: 'customer',       // 默认买家
          pickupCode: pickupCode,
          createTime: new Date()
        }
      })
      user = { openid, nickName, avatarUrl, role: 'customer', pickupCode: pickupCode }
    } catch (err) {
      console.error('注册用户失败', err)
      return { code: -1, message: '注册失败' }
    }
  } else if (!user.pickupCode) {
    // 已有用户但没有取货码，添加取货码
    let retryCount = 0
    const maxRetries = 3
    let success = false
    
    while (retryCount < maxRetries && !success) {
      try {
        const pickupCode = generateSixDigitCode(openid)
        await db.collection('users').where({ openid }).update({
          data: {
            pickupCode: pickupCode
          }
        })
        user.pickupCode = pickupCode
        success = true
      } catch (err) {
        retryCount++
        console.error(`添加取货码失败 (尝试 ${retryCount}/${maxRetries})`, err)
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
        }
      }
    }
    
    if (!success) {
      console.error('添加取货码最终失败，超过最大重试次数')
    }
  }

  // 测试模式：如果开发者白名单内且前端传 forceMerchant=true，返回商家角色
  const isDev = DEVELOPER_OPENIDS.includes(openid)
  if (isDev && event.forceMerchant === true) {
    return { code: 0, role: 'merchant', user: user }
  }

  // 正常返回数据库角色
  return { code: 0, role: user.role, user: user }
}