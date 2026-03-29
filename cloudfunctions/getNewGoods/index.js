// 云函数：getNewGoods
// 目的：返回“今日上新”商品列表
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    // 常用参数：limit、page（从0开始）、sortField、sortOrder
    const limit = Number.isNaN(Number(event.limit)) ? 30 : Math.max(1, Math.min(100, Number(event.limit)));
    const page = Number.isNaN(Number(event.page)) ? 0 : Math.max(0, Number(event.page));
    const skip = page * limit;

    const sortField = event.sortField || 'createdAt';
    const sortOrder = (event.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // 查询条件：优先 isNew=true；如果没有上新标记，可查询最近 30 天内上架的商品。
    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 1000 * 60 * 60 * 24 * 30);

    const baseFilter = {
      // 建议你的 goods 集合字段使用 isNew 字段，下面会优先按它筛选
      isNew: true,
      // 若你有 status 字段，这里可以打开
      // status: 'active',
    };

    let items = await db
      .collection('goods')
      .where(baseFilter)
      .orderBy(sortField, sortOrder)
      .skip(skip)
      .limit(limit)
      .get();

    // 如果没有任何 isNew 商品，自动降级为 30 天内新增商品
    if ((!items.data || items.data.length === 0) && page === 0) {
      const secondFilter = {
        createdAt: _.gte(thirtyDaysAgo),
        // status: 'active',
      };

      const fallback = await db
        .collection('goods')
        .where(secondFilter)
        .orderBy(sortField, sortOrder)
        .skip(skip)
        .limit(limit)
        .get();

      items = fallback;
    }

    // count 仅当 page===0 时可读; page>0 可直接按 list 返回，避免重复调用 count API
    let total = -1;
    if (page === 0) {
      try {
        const countResult = await db.collection('goods').count();
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
    console.error('getNewGoods云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取商品失败',
      data: [],
    };
  }
};
