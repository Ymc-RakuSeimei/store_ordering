// 云函数：createOrder
// 目的：创建新订单
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });



exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    // 接收订单参数
    const { openid, goods, customerInfo, totalPrice, remark, pickupCode } = event;

    // 验证必要参数
    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: null,
      };
    }

    if (!goods || !Array.isArray(goods) || goods.length === 0) {
      return {
        code: -1,
        message: '请选择商品',
        data: null,
      };
    }

    // 生成订单号
    const orderNo = 'ORD' + Date.now() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // 获取用户信息和取货码
    let orderPickupCode = pickupCode;
    let userInfo = {};

    const userResult = await db.collection('users').where({ openid }).get();
    if (userResult.data.length > 0) {
      const user = userResult.data[0];
      // 获取用户信息
      userInfo = {
        avatarUrl: user.avatarUrl || '',
        name: user.nickName || '',
        phone: user.phoneNumber || ''
      };
      // 获取用户的取货码
      if (!orderPickupCode && user.pickupCode) {
        orderPickupCode = user.pickupCode;
      }
    }

    // 如果用户没有取货码，生成一个新的
    if (!orderPickupCode) {
      let hash = 0;
      for (let i = 0; i < openid.length; i++) {
        const char = openid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      orderPickupCode = (Math.abs(hash) % 900000 + 100000).toString();

      // 更新用户的取货码
      let retryCount = 0
      const maxRetries = 3
      let success = false

      while (retryCount < maxRetries && !success) {
        try {
          await db.collection('users').where({ openid }).update({
            data: {
              pickupCode: orderPickupCode
            }
          });
          success = true
        } catch (err) {
          retryCount++
          console.error(`更新用户取货码失败 (尝试 ${retryCount}/${maxRetries})`, err)
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount))
          }
        }
      }

      if (!success) {
        console.error('更新用户取货码最终失败，超过最大重试次数')
      }
    }

    // 构建订单数据
    const orderData = {
      orderNo: orderNo,
      openid: openid,
      pickupCode: orderPickupCode,
      goods: goods,
      customerInfo: { ...userInfo, ...customerInfo },
      totalPrice: totalPrice || 0,
      remark: remark || '',
      status: '待取货', // 未到货、待取货、已取货
      paytime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存订单到数据库
    const result = await db.collection('orders').add({
      data: orderData
    });

    // 获取完整的订单信息
    const order = await db.collection('orders').doc(result._id).get();

    return {
      code: 0,
      message: '订单创建成功',
      data: order.data,
    };
  } catch (err) {
    console.error('createOrder云函数错误', err);
    return {
      code: -1,
      message: err.message || '订单创建失败',
      data: null,
    };
  }
};