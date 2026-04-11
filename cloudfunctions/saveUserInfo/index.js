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
  
  while (exists) {
    pickupCode = generatePickupCode()
    exists = await isPickupCodeExists(pickupCode)
  }
  
  return pickupCode
}

exports.main = async (event, context) => {
  // 接收前端传来的参数
  const { nickName, avatarUrl, phoneNumber } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('收到参数:', { nickName, avatarUrl, phoneNumber, openid })

  try {
    const userRes = await db.collection('users').where({ openid }).get()

    if (userRes.data.length > 0) {
      // 更新现有用户
      const user = userRes.data[0]
      const updateData = {}
      
      // 只在有值时更新对应字段
      if (nickName !== undefined && nickName !== null && nickName !== '') {
        updateData.nickName = nickName
      }
      if (avatarUrl !== undefined && avatarUrl !== null && avatarUrl !== '') {
        updateData.avatarUrl = avatarUrl
      }
      if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber !== '') {
        updateData.phoneNumber = phoneNumber
        console.log('准备更新手机号:', phoneNumber)
      }
      
      // 检查是否有pickupCode字段，如果没有则生成
      if (!user.pickupCode) {
        updateData.pickupCode = await generateUniquePickupCode()
        console.log('为用户生成取货码:', updateData.pickupCode)
      }
      
      // 如果有需要更新的字段才执行更新
      if (Object.keys(updateData).length > 0) {
        await db.collection('users').doc(user._id).update({
          data: updateData
        })
        console.log('更新成功:', updateData)
      } else {
        console.log('没有需要更新的字段')
      }
      
      return { success: true, action: 'update' }
    } else {
      // 新增用户，默认角色为 customer
      const pickupCode = await generateUniquePickupCode()
      
      const newUser = {
        openid,
        role: 'customer',
        pickupCode,
        createTime: db.serverDate()
      }
      
      if (nickName && nickName !== '') newUser.nickName = nickName
      if (avatarUrl && avatarUrl !== '') newUser.avatarUrl = avatarUrl
      if (phoneNumber && phoneNumber !== '') newUser.phoneNumber = phoneNumber
      
      await db.collection('users').add({
        data: newUser
      })
      console.log('新用户创建，取货码:', pickupCode)
      return { success: true, action: 'create' }
    }
  } catch (err) {
    console.error('云函数错误:', err)
    return { success: false, error: err.message }
  }
}