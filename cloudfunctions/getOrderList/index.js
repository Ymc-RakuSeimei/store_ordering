// 云函数：getOrderList
// 作用：按用户获取订单列表，支持分页与基础状态筛选。
const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    const limit = Number.isNaN(Number(event.limit)) ? 30 : Math.max(1, Math.min(100, Number(event.limit)));
    const page = Number.isNaN(Number(event.page)) ? 0 : Math.max(0, Number(event.page));
    const skip = page * limit;
    const status = String(event.status || '').trim();
    const openid = String(event.openid || '').trim();

    console.log('getOrderList called with:', {
      limit,
      page,
      status,
      openid
    });

    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: []
      };
    }

    const filter = { openid };

    if (status && status !== 'all') {
      if (status === 'waiting') {
        // waiting 视图需要同时包含待取货和未到货。
        filter.status = _.in(['待取货', '未到货', '已到货']);
      } else if (status === 'completed') {
        filter.status = _.in(['已完成']);
      } else {
        filter.status = status;
      }
    }

    const items = await db
      .collection('orders')
      .where(filter)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    let total = -1;
    if (page === 0) {
      try {
        const countResult = await db.collection('orders').where(filter).count();
        total = countResult.total;
      } catch (countErr) {
        console.error('getOrderList count failed', countErr);
        total = -1;
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: items.data || [],
      page,
      limit,
      total
    };
  } catch (err) {
    console.error('getOrderList 云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取订单列表失败',
      data: []
    };
  }
};
