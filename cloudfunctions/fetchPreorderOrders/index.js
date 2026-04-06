const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

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

function pickImage(item = {}) {
  if (Array.isArray(item.images) && item.images[0]) {
    return item.images[0];
  }
  if (typeof item.img === 'string' && item.img.trim()) {
    return item.img.trim();
  }
  return DEFAULT_PRODUCT_IMAGE;
}

function getGoodsSpec(item = {}) {
  return String(item.specs || item.spec || '').trim();
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const { goodsId } = event;

    if (!goodsId) {
      return {
        code: -1,
        message: '缺少商品ID',
        data: null
      };
    }

    // 1. 获取商品详情
    const goodsRes = await db.collection('goods').doc(goodsId).get();
    const goods = goodsRes.data;

    if (!goods) {
      return {
        code: -1,
        message: '商品不存在',
        data: null
      };
    }

    // 2. 获取该商品的所有订单
    const allOrders = await fetchAllByWhere('orders', {});

    // 3. 筛选出包含该商品的订单
    const relevantOrders = [];
    const participantMap = new Map();

    allOrders.forEach(order => {
      const goodsList = Array.isArray(order.goods) ? order.goods : [];
      let hasTargetGoods = false;
      let targetItem = null;

      for (const item of goodsList) {
        const itemGoodsId = String(item.goodsId || item.goodsDocId || '').trim();
        if (itemGoodsId === goodsId || itemGoodsId === String(goods.goodsId || '').trim()) {
          hasTargetGoods = true;
          targetItem = item;
          break;
        }
      }

      if (hasTargetGoods && targetItem) {
        const customerInfo = order.customerInfo || {};
        const openid = String(order.openid || '').trim();
        const quantity = Number(targetItem.quantity) || 0;

        const orderData = {
          orderId: order._id,
          orderNo: order.orderNo || '',
          customerName: customerInfo.name || customerInfo.nickName || '微信用户',
          avatarUrl: customerInfo.avatarUrl || '',
          phone: customerInfo.phone || customerInfo.phoneNumber || '',
          quantity: quantity,
          pickupStatus: targetItem.pickupStatus || '',
          orderTime: formatDate(order.paytime || order.createdAt || order.updatedAt),
          remark: String(order.remark || '').trim()
        };

        relevantOrders.push(orderData);

        // 统计参与人数（按用户去重
        if (openid && !participantMap.has(openid)) {
          participantMap.set(openid, {
            name: orderData.customerName,
            avatarUrl: orderData.avatarUrl
          });
        }
      }
    });

    // 4. 计算统计数据
    const participantCount = participantMap.size;
    const totalQty = relevantOrders.reduce((sum, o) => sum + o.quantity, 0);

    // 5. 整理商品信息
    const imageList = Array.isArray(goods.images) ? goods.images.filter(isUsableImage) : [];
    const image = imageList[0] || DEFAULT_PRODUCT_IMAGE;

    const goodsDetail = {
      id: goods._id,
      goodsId: goods.goodsId || goods._id,
      img: image,
      name: goods.name || '',
      description: goods.description || '',
      spec: getGoodsSpec(goods),
      salePrice: goods.salePrice || 0,
      costPrice: goods.costPrice || 0,
      stock: goods.stock || 0,
      limitPerPerson: goods.limitPerPerson || 0,
      arrivalDate: goods.arrivalDate || '',
      closeType: goods.closeType || 'manual',
      closeTimeStr: goods.closeTimeStr || '',
      preorderState: goods.preorderState || 'ongoing',
      status: goods.status || '',
      closedAt: formatDate(goods.closedAt),
      arrivalTime: formatDate(goods.arrivalTime),
      createdAt: formatDate(goods.createdAt),
      // 统计数据
      participantCount,
      totalQty
    };

    // 6. 按时间倒序排列订单
    relevantOrders.sort((a, b) => {
      return toTimestamp(b.orderTime) - toTimestamp(a.orderTime);
    });

    return {
      code: 0,
      message: 'ok',
      data: {
        goods: goodsDetail,
        orders: relevantOrders
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
