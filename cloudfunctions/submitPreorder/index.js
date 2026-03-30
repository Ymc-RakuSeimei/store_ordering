// 云函数 submitPreorder - 提交接龙参与
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { dragonId, quantity, remark } = event

  if (!dragonId || !quantity || quantity < 1) {
    return { code: -1, message: '参数错误' }
  }

  const transaction = await db.startTransaction()

  try {
    // 1. 查询接龙状态
    const dragonRes = await transaction.collection('preorder_dragons').doc(dragonId).get()
    if (!dragonRes.data) {
      await transaction.rollback()
      return { code: -1, message: '接龙不存在' }
    }
    if (dragonRes.data.status === 'completed') {
      await transaction.rollback()
      return { code: -1, message: '接龙已结束' }
    }

    // 2. 查询用户是否已参与
    const existingRes = await transaction.collection('preorder_participants')
      .where({
        dragonId: dragonId,
        userId: openid
      })
      .get()

    if (existingRes.data.length > 0) {
      await transaction.rollback()
      return { code: -1, message: '您已参与此接龙' }
    }

    // 3. 获取用户信息
    const userRes = await transaction.collection('users').where({ openid }).get()
    if (userRes.data.length === 0) {
      await transaction.rollback()
      return { code: -1, message: '用户不存在，请先登录' }
    }
    const user = userRes.data[0]

    // 4. 添加参与记录
    const now = new Date()
    await transaction.collection('preorder_participants').add({
      data: {
        dragonId: dragonId,
        userId: openid,
        userName: user.nickName || '微信用户',
        avatarUrl: user.avatarUrl || '',
        qty: quantity,
        remark: remark || '',
        joinTime: now,
        createTime: now
      }
    })

    await transaction.commit()

    return { code: 0, message: '参与成功' }
  } catch (err) {
    console.error('提交接龙参与失败', err)
    try {
      await transaction.rollback()
    } catch (rollbackErr) {
      console.error('事务回滚失败', rollbackErr)
    }
    return { code: -1, message: err.message || '提交失败' }
  }
}
