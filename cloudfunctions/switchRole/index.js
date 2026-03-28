// 云函数 switchRole——用于开发测试时切换角色
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

const DEVELOPER_OPENIDS = ['oqClo15h3ZO3ZZ5h30s6vUcpYBMI', 'oqClo1zp-lntsO0ghtMPr7b8L4HA', 'oqClo14495w0vH3m1H3OPtWdJStA', 'oqClo182WJ4T9t6bP_X0SzL3crSc'] // 白名单

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 仅白名单内允许切换
  if (!DEVELOPER_OPENIDS.includes(openid)) {
    return { code: -1, message: '无权限' }
  }

  const { targetRole } = event // 'customer' 或 'merchant'
  if (!['customer', 'merchant'].includes(targetRole)) {
    return { code: -1, message: '角色错误' }
  }

  try {
    await db.collection('users').where({ openid }).update({
      data: { role: targetRole }
    })
    return { code: 0, message: '切换成功' }
  } catch (err) {
    return { code: -1, message: '更新失败' }
  }
}