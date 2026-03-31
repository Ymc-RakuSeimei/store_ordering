// 云函数：getGoodsDetail
// 目的：根据商品ID获取商品详情
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const db = cloud.database();

  try {
    // 接收商品ID参数
    const { goodsId } = event;

    // 验证必要参数
    if (!goodsId) {
      return {
        code: -1,
        message: '缺少商品ID',
        data: null,
      };
    }

    // 查询商品详情
    const result = await db.collection('goods').doc(goodsId).get();

    if (!result.data) {
      return {
        code: -1,
        message: '商品不存在',
        data: null,
      };
    }

    return {
      code: 0,
      message: 'ok',
      data: result.data,
    };
  } catch (err) {
    console.error('getGoodsDetail云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取商品详情失败',
      data: null,
    };
  }
};