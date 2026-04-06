const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

async function assertMerchant(openid) {
  console.log('Checking merchant for openid:', openid);
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  console.log('User query result:', userRes);
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限访问');
  }

  return user;
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

exports.main = async (event) => {
  console.log('fetchFeedbackList called with event:', event);
  try {
    const { OPENID } = cloud.getWXContext();
    console.log('OPENID:', OPENID);

    await assertMerchant(OPENID);
    console.log('Merchant check passed');

    // 先不排序，简单查询试试
    console.log('Querying feedbacks collection...');
    const res = await db
      .collection('feedbacks')
      .get();

    console.log('Feedbacks query result, count:', (res.data || []).length);
    console.log('Feedbacks data:', res.data);

    const feedbacks = (res.data || []).map(item => ({
      id: item._id,
      _id: item._id,
      type: item.type || '意见反馈',
      orderId: item.orderId || '',
      orderNo: item.orderNo || '',
      goodsId: item.goodsId || '',
      goodsName: item.goodsName || '',
      afterSaleType: item.afterSaleType || '',
      reason: item.reason || '',
      content: item.content || '',
      rating: item.rating || 0,
      images: item.images || [],
      status: item.status || '待处理',
      left: item.status || '待处理',
      name: item.goodsName || item.type || '售后反馈',
      orderName: item.goodsName || item.type || '售后反馈',
      spec: item.reason || item.content || '',
      createdAt: formatDate(item.createdAt),
      updatedAt: formatDate(item.updatedAt)
    }));

    console.log('Returning feedbacks:', feedbacks);

    return {
      code: 0,
      message: 'ok',
      data: feedbacks
    };
  } catch (err) {
    console.error('fetchFeedbackList error', err);
    return {
      code: -1,
      message: err.message || '获取反馈列表失败',
      data: []
    };
  }
};
