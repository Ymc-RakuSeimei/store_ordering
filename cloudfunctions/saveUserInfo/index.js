const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { nickName, avatarUrl } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length > 0) {
      // 更新现有用户
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: {
          nickName,
          avatarUrl
        }
      })
      return { success: true, action: 'update' }
    } else {
      // 新增用户，默认角色为 customer
      await db.collection('users').add({
        data: {
          openid,
          nickName,
          avatarUrl,
          role: 'customer',
          createTime: db.serverDate()
        }
      })
      return { success: true, action: 'create' }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}