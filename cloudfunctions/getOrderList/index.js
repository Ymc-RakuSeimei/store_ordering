// 云函数：getOrderList
// 目的：返回用户订单列表，支持分页和状态筛选
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    // 常用参数：limit、page（从0开始）、status、openid
    const limit = Number.isNaN(Number(event.limit)) ? 30 : Math.max(1, Math.min(100, Number(event.limit)));
    const page = Number.isNaN(Number(event.page)) ? 0 : Math.max(0, Number(event.page));
    const skip = page * limit;
    const status = event.status || '';
    const openid = event.openid;

    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: [],
      };
    }

    // 构建查询条件
    const filter = {
      openid: openid
    };
    
    // 状态筛选
    if (status) {
      if (status === 'waiting') {
        filter.status = '待取货';
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

    // 为每个订单获取商品详情
    if (items.data && items.data.length > 0) {
      for (let i = 0; i < items.data.length; i++) {
        const order = items.data[i];
        if (order.goods && order.goods.length > 0) {
          // 这里可以根据需要关联查询商品详情
          // 例如：使用 db.collection('goods').where({_id: _.in(goodsIds)}).get()
        }
      }
    }

    // count 仅当 page===0 时可读; page>0 可直接按 list 返回，避免重复调用 count API
    let total = -1;
    if (page === 0) {
      try {
        const countResult = await db.collection('orders').where(filter).count();
        total = countResult.total;
      } catch (countErr) {
        // count 失败不阻断列表返回
        total = -1;
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: items.data || [],
      page,
      limit,
      total,
    };
  } catch (err) {
    console.error('getOrderList云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取订单列表失败',
      data: [],
    };
  }
};