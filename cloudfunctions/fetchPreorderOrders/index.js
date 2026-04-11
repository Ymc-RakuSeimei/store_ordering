const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const STATUS_WAITING = '未到货';
const LEGACY_STATUS_WAITING = '待到货';

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

function formatTime(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeWaitingStatus(value = '') {
  const text = String(value || '').trim();
  return text === LEGACY_STATUS_WAITING ? STATUS_WAITING : text;
}

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限访问预售订货');
  }

  return user;
}

async function fetchAllByWhere(collectionName, whereCondition, limit = 100) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  let skip = 0;
  const result = [];

  while (true) {
    const res = await db
      .collection(collectionName)
      .where(whereCondition)
      .skip(skip)
      .limit(safeLimit)
      .get();

    const list = res.data || [];
    result.push(...list);

    if (list.length < safeLimit) {
      break;
    }

    skip += safeLimit;
  }

  return result;
}

async function findGoodsByIdentity(identity = '') {
  const safeIdentity = String(identity || '').trim();
  if (!safeIdentity) {
    return null;
  }

  try {
    const docRes = await db.collection('goods').doc(safeIdentity).get();
    if (docRes && docRes.data) {
      return docRes.data;
    }
  } catch (error) {
    // 如果不是 docId，再按业务 goodsId 查询。
  }

  const goodsList = await db.collection('goods').where({ goodsId: safeIdentity }).limit(1).get();
  return (goodsList.data || [])[0] || null;
}

function pickImage(item = {}) {
  if (Array.isArray(item.images) && item.images.length > 0) {
    const image = item.images.find(isUsableImage);
    if (image) {
      return image;
    }
  }

  if (typeof item.img === 'string' && item.img.trim()) {
    return item.img.trim();
  }

  return DEFAULT_PRODUCT_IMAGE;
}

function getGoodsSpec(item = {}) {
  return String(item.specs || item.spec || '').trim();
}

function buildCloseTimeStr(goods = {}) {
  if (goods.closeType !== 'timed' || !goods.closeAt) {
    return '';
  }

  return formatTime(goods.closeAt);
}

function buildClosedAt(goods = {}) {
  if (goods.preorderState !== 'closed') {
    return '';
  }

  return formatDateTime(goods.closeAt);
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const goodsIdentity = String(event.goodsId || '').trim();
    if (!goodsIdentity) {
      return {
        code: -1,
        message: '缺少商品ID',
        data: null
      };
    }

    const goods = await findGoodsByIdentity(goodsIdentity);

    if (!goods) {
      return {
        code: -1,
        message: '商品不存在',
        data: null
      };
    }

    const allOrders = await fetchAllByWhere('orders', {});
    const relevantOrders = [];
    const participantMap = new Map();
    const targetGoodsId = String(goods.goodsId || '').trim();
    const targetDocId = String(goods._id || '').trim();

    allOrders.forEach((order) => {
      const goodsList = Array.isArray(order.goods) ? order.goods : [];
      const targetItem = goodsList.find((item) => {
        const itemGoodsId = String(item.goodsId || '').trim();
        const itemDocId = String(item.goodsDocId || '').trim();

        return itemGoodsId === targetGoodsId || itemGoodsId === targetDocId || itemDocId === targetDocId;
      });

      if (!targetItem) {
        return;
      }

      const customerInfo = order.customerInfo || {};
      const orderTime = order.paytime || order.createdAt || order.updatedAt;
      const orderTimeTs = toTimestamp(orderTime);
      const openid = String(order.openid || '').trim();
      const quantity = Number(targetItem.quantity) || 0;

      relevantOrders.push({
        orderId: order._id,
        orderNo: order.orderNo || '',
        customerName: customerInfo.name || customerInfo.nickName || '微信用户',
        avatarUrl: customerInfo.avatarUrl || '',
        phone: customerInfo.phone || customerInfo.phoneNumber || '',
        quantity,
        pickupStatus: normalizeWaitingStatus(targetItem.pickupStatus) || '',
        orderTime: formatDateTime(orderTime),
        orderTimeTs,
        remark: String(order.remark || '').trim()
      });

      if (openid && !participantMap.has(openid)) {
        participantMap.set(openid, {
          name: customerInfo.name || customerInfo.nickName || '微信用户',
          avatarUrl: customerInfo.avatarUrl || ''
        });
      }
    });

    relevantOrders.sort((a, b) => b.orderTimeTs - a.orderTimeTs);

    const participantCount = participantMap.size;
    const totalQty = relevantOrders.reduce((sum, item) => sum + item.quantity, 0);

    const goodsDetail = {
      id: goods._id,
      goodsId: goods.goodsId || goods._id,
      img: pickImage(goods),
      name: goods.name || '',
      description: goods.description || '',
      spec: getGoodsSpec(goods),
      salePrice: Number(goods.price) || 0,
      costPrice: Number(goods.cost) || 0,
      stock: Number(goods.stock) || 0,
      limitPerPerson: Number(goods.limitPerPerson) || 0,
      arrivalDate: goods.arrivalDate || '',
      closeType: goods.closeType || 'manual',
      closeTimeStr: buildCloseTimeStr(goods),
      preorderState: goods.preorderState || 'ongoing',
      status: normalizeWaitingStatus(goods.status) || STATUS_WAITING,
      closedAt: buildClosedAt(goods),
      arrivalTime: formatDateTime(goods.arrivedAt || goods.arrivalTime),
      createdAt: formatDateTime(goods.createdAt),
      participantCount,
      totalQty
    };

    return {
      code: 0,
      message: 'ok',
      data: {
        goods: goodsDetail,
        orders: relevantOrders.map(({ orderTimeTs, ...item }) => item)
      }
    };
  } catch (err) {
    console.error('fetchPreorderOrders error', err);
    return {
      code: -1,
      message: err.message || '获取详情失败',
      data: null
    };
  }
};
