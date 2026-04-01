// 云函数：getGoodsList
// 目的：返回商品列表，支持分类、筛选、分页
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    // 常用参数：limit、page（从0开始）、sortField、sortOrder、category
    const limit = Number.isNaN(Number(event.limit)) ? 30 : Math.max(1, Math.min(100, Number(event.limit)));
    const page = Number.isNaN(Number(event.page)) ? 0 : Math.max(0, Number(event.page));
    const skip = page * limit;

    const sortField = event.sortField || 'createdAt';
    const sortOrder = (event.sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const category = event.category || '';
    const keyword = event.keyword || '';

    // 构建查询条件
    const filter = {};
    
    // 分类筛选
    if (category) {
      filter.category = category;
    }
    
    // 关键词搜索
    if (keyword) {
      filter.name = db.RegExp({
        regexp: keyword,
        options: 'i'
      });
    }
    
    // 状态筛选（如果有）
    // filter.status = 'active';

    const items = await db
      .collection('goods')
      .where(filter)
      .orderBy(sortField, sortOrder)
      .skip(skip)
      .limit(limit)
      .get();

    // 预定商品只在“接龙进行中”时展示给顾客。
    // 已截单商品仍保留在 goods 集合，但不再继续出现在买家端预定区。
    const visibleGoods = (items.data || []).filter((item) => {
      if (item.type !== 'preorder') {
        return true;
      }

      if (item.preorderState === 'closed') {
        return false;
      }

      if (item.closeType === 'timed' && item.closeAt) {
        const closeAt = new Date(item.closeAt).getTime();
        if (!Number.isNaN(closeAt) && closeAt <= Date.now()) {
          return false;
        }
      }

      return true;
    });

    // count 仅当 page===0 时可读; page>0 可直接按 list 返回，避免重复调用 count API
    let total = -1;
    if (page === 0) {
      try {
        const countResult = await db.collection('goods').where(filter).count();
        total = countResult.total;
      } catch (countErr) {
        // count 失败不阻断列表返回
        total = -1;
      }
    }

    return {
      code: 0,
      message: 'ok',
      data: visibleGoods,
      page,
      limit,
      total,
    };
  } catch (err) {
    console.error('getGoodsList云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取商品列表失败',
      data: [],
    };
  }
};
