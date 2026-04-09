const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

const STATUS_WAITING = '未到货';
const LEGACY_STATUS_WAITING = '待到货';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

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

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value === 'object' && value.$date) {
    const exportedTimestamp = new Date(value.$date).getTime();
    return Number.isNaN(exportedTimestamp) ? 0 : exportedTimestamp;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateTime(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const pad = (num) => String(num).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeWaitingStatus(value = '') {
  const text = String(value || '').trim();
  return text === LEGACY_STATUS_WAITING ? STATUS_WAITING : text;
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
  const preorderState = item.preorderState === 'closed' ? 'closed' : 'ongoing';

  return {
    id: item._id,
    goodsId: item.goodsId || '',
    img: imageList[0] || DEFAULT_PRODUCT_IMAGE,
    name: item.name || '',
    spec: String(item.specs || item.spec || '').trim(),
    totalQty: Number(item.totalBooked) || 0,
    arrivalDate: item.arrivalDate || '',
    status: normalizeWaitingStatus(item.status) || STATUS_WAITING,
    preorderState,
    closeType: item.closeType || 'manual',
    closedAt: preorderState === 'closed' ? formatDateTime(item.closeAt) : '',
    arrivalTime: formatDateTime(item.arrivedAt || item.arrivalTime),
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
      const now = new Date();

      await Promise.all(
        autoCloseTargets.map((item) =>
          db.collection('goods').doc(item._id).update({
            data: {
              preorderState: 'closed',
              updatedAt: now
            }
          })
        )
      );

      autoCloseTargets.forEach((item) => {
        item.preorderState = 'closed';
        item.updatedAt = now;
      });
    }

    const current = [];
    const completed = [];

    items
      .slice()
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
    console.error('fetchPreorderList error', err);
    return {
      code: -1,
      message: err.message || '获取接龙列表失败',
      data: null
    };
  }
};
