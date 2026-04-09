const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限截单');
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

    if (goods.preorderState === 'closed') {
      return {
        code: 0,
        message: '已截单',
        data: { id }
      };
    }

    const now = new Date();

    await db.collection('goods').doc(id).update({
      data: {
        preorderState: 'closed',
        closeAt: now,
        status: goods.status === '已到货' ? '已到货' : '未到货',
        updatedAt: now
      }
    });

    return {
      code: 0,
      message: '已截单',
      data: {
        id
      }
    };
  } catch (err) {
    console.error('stopPreorder error', err);
    return {
      code: -1,
      message: err.message || '截止失败',
      data: null
    };
  }
};
