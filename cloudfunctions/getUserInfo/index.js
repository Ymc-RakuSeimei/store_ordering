const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
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
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}