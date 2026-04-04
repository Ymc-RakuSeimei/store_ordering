const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限截止接龙');
  }

  return user;
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const id = String(event.id || '').trim();
    if (!id) {
      throw new Error('缺少接龙商品ID');
    }

    const goodsRes = await db.collection('goods').doc(id).get();
    const goods = goodsRes.data;

    if (!goods || goods.type !== 'preorder') {
      throw new Error('接龙商品不存在');
    }

    await db.collection('goods').doc(id).update({
      data: {
        preorderState: 'closed',
        closedAt: new Date(),
        status: '待到货',
        updatedAt: new Date()
      }
    });

    return {
      code: 0,
      message: '已截止',
      data: {
        id
      }
    };
  } catch (err) {
    console.error('stopPreorder 云函数错误', err);
    return {
      code: -1,
      message: err.message || '截止失败',
      data: null
    };
  }
};
