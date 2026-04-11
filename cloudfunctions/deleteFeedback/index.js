const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限删除反馈');
  }

  return user;
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const feedbackId = String(event.id || '').trim();
    if (!feedbackId) {
      throw new Error('缺少反馈ID');
    }

    const result = await db.collection('feedbacks').doc(feedbackId).remove();

    return {
      code: 0,
      message: '删除成功',
      data: {
        id: feedbackId,
        removed: result.stats?.removed || 1
      }
    };
  } catch (err) {
    console.error('deleteFeedback 云函数错误', err);
    return {
      code: -1,
      message: err.message || '删除失败',
      data: null
    };
  }
};
