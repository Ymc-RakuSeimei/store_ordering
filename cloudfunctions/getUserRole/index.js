// 云函数 getUserRole
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

// 开发测试白名单
const DEVELOPER_OPENIDS = ['oqClo15h3ZO3ZZ5h30s6vUcpYBMI', 'oqClo1zp-lntsO0ghtMPr7b8L4HA', 'oqClo14495w0vH3m1H3OPtWdJStA'] // 需要替换为真实 openid

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

  // 自动注册
  if (!user) {
    const { nickName = '微信用户', avatarUrl = '' } = event.userInfo || {}
    try {
      const addRes = await db.collection('users').add({
        data: {
          openid,
          nickName,
          avatarUrl,
          role: 'customer',       // 默认买家
          createTime: new Date()
        }
      })
      user = { openid, nickName, avatarUrl, role: 'customer' }
    } catch (err) {
      console.error('注册用户失败', err)
      return { code: -1, message: '注册失败' }
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