// 云函数：getPickupCode
// 目的：生成或获取用户的取货码
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    const { openid } = event;

    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: null,
      };
    }

    // 查找用户的取货码记录
    const existingCode = await db.collection('pickupCodes').where({
      openid: openid
    }).get();

    let pickupCode;

    if (existingCode.data && existingCode.data.length > 0) {
      // 如果已有取货码，直接返回
      pickupCode = existingCode.data[0].pickupCode;
    } else {
      // 如果没有取货码，生成新的
      pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 保存到数据库
      await db.collection('pickupCodes').add({
        data: {
          openid: openid,
          pickupCode: pickupCode,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    return {
      code: 0,
      message: 'ok',
      data: {
        pickupCode: pickupCode
      },
    };
  } catch (err) {
    console.error('getPickupCode云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取取货码失败',
      data: null,
    };
  }
};