const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限访问预售订货');
  }

  return user;
}

function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://');
}

function toTimestamp(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function shouldAutoClose(item = {}) {
  if (item.type !== 'preorder') return false;
  if (item.preorderState === 'closed') return false;
  if (item.closeType !== 'timed') return false;
  if (!item.closeAt) return false;
  return toTimestamp(item.closeAt) <= Date.now();
}

function normalizePreorderItem(item = {}) {
  const imageList = Array.isArray(item.images) ? item.images.filter(isUsableImage) : [];
  const image = imageList[0] || DEFAULT_PRODUCT_IMAGE;
  const preorderState = item.preorderState === 'closed' ? 'closed' : 'ongoing';

  return {
    id: item._id,
    goodsId: item.goodsId || '',
    img: image,
    name: item.name || '',
    spec: item.specs || item.spec || '',
    totalQty: Number(item.totalBooked) || 0,
    arrivalDate: item.arrivalDate || '',
    status: preorderState === 'closed' ? 'completed' : 'ongoing',
    preorderState,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const res = await db.collection('goods').where({ type: 'preorder' }).get();
    const items = res.data || [];

    const autoCloseTargets = items.filter(shouldAutoClose);
    if (autoCloseTargets.length > 0) {
      await Promise.all(
        autoCloseTargets.map((item) =>
          db.collection('goods').doc(item._id).update({
            data: {
              preorderState: 'closed',
              updatedAt: new Date()
            }
          })
        )
      );

      autoCloseTargets.forEach((item) => {
        item.preorderState = 'closed';
        item.updatedAt = new Date();
      });
    }

    const current = [];
    const completed = [];

    items
      .sort((a, b) => toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt))
      .map(normalizePreorderItem)
      .forEach((item) => {
        if (item.preorderState === 'closed') {
          completed.push(item);
          return;
        }
        current.push(item);
      });

    return {
      code: 0,
      message: 'ok',
      data: {
        current,
        completed
      }
    };
  } catch (err) {
    console.error('fetchPreorderList 云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取接龙列表失败',
      data: null
    };
  }
};
