const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();

// 删除商品前，先确认当前用户确实是商家身份。
async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限删除商品');
  }

  return user;
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const id = String(event.id || '').trim();
    if (!id) {
      throw new Error('缺少商品ID');
    }

    // 删除前先读一次，便于做存在性校验，也方便把已删除商品信息返回给前端。
    const productRes = await db.collection('goods').doc(id).get();
    const product = productRes.data;

    if (!product) {
      throw new Error('商品不存在');
    }

    await db.collection('goods').doc(id).remove();

    return {
      code: 0,
      message: '删除成功',
      data: {
        id,
        product
      }
    };
  } catch (err) {
    console.error('deleteProduct 云函数错误', err);
    return {
      code: -1,
      message: err.message || '删除商品失败',
      data: null
    };
  }
};
