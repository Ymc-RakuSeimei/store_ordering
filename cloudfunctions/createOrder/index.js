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
    const { openid, goods, address, totalPrice, remark } = event;

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

    // 构建订单数据
    const orderData = {
      orderNo: orderNo,
      openid: openid,
      goods: goods,
      address: address || {},
      totalPrice: totalPrice || 0,
      remark: remark || '',
      status: 'pending', // pending, paid, delivered, completed, cancelled
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