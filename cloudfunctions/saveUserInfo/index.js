const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 生成6位数字取货码
function generatePickupCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 检查取货码是否已存在
async function isPickupCodeExists(pickupCode) {
  const res = await db.collection('users').where({ pickupCode }).get()
  return res.data.length > 0
}

// 生成唯一的取货码
async function generateUniquePickupCode() {
  let pickupCode = generatePickupCode()
  let exists = await isPickupCodeExists(pickupCode)
  
  // 如果取货码已存在，重新生成
  while (exists) {
    pickupCode = generatePickupCode()
    exists = await isPickupCodeExists(pickupCode)
  }
  
  return pickupCode
}

exports.main = async (event, context) => {
  const { nickName, avatarUrl } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length > 0) {
      // 更新现有用户
      const user = userRes.data[0]
      const updateData = {
        nickName,
        avatarUrl
      }
      
      // 检查是否有pickupCode字段，如果没有则生成
      if (!user.pickupCode) {
        updateData.pickupCode = await generateUniquePickupCode()
        console.log('为用户生成取货码:', updateData.pickupCode)
      }
      
      await db.collection('users').doc(user._id).update({
        data: updateData
      })
      return { success: true, action: 'update' }
    } else {
      // 新增用户，默认角色为 customer
      const pickupCode = await generateUniquePickupCode()
      
      await db.collection('users').add({
        data: {
          openid,
          nickName,
          avatarUrl,
          role: 'customer',
          pickupCode,
          createTime: db.serverDate()
        }
      })
      console.log('新用户创建，取货码:', pickupCode)
      return { success: true, action: 'create' }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}