const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

const STATUS_WAITING = '\u672a\u5230\u8d27';
const STATUS_PENDING_PICKUP = '\u5f85\u53d6\u8d27';
const STATUS_PICKED = '\u5df2\u53d6\u8d27';
const STATUS_COMPLETED = '\u5df2\u5b8c\u6210';
const LEGACY_STATUS_WAITING = '\u5f85\u5230\u8d27';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限执行数据库修订');
  }

  return user;
}

async function fetchAllByWhere(collectionName, whereCondition = {}, limit = 100) {
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

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (value && typeof value === 'object' && value.$date) {
    const exportedDate = new Date(value.$date);
    return Number.isNaN(exportedDate.getTime()) ? null : exportedDate;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toTimestamp(value) {
  const date = normalizeDate(value);
  return date ? date.getTime() : 0;
}

function isSameDate(left, right) {
  return toTimestamp(left) === toTimestamp(right);
}

function buildGoodsId(docId = '') {
  return `GD_${String(docId).toUpperCase()}`;
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function getCanonicalSpec(item = {}) {
  return String(item.specs || item.spec || '').trim();
}

function getCanonicalImages(item = {}) {
  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.filter(Boolean);
  }

  if (typeof item.img === 'string' && item.img.trim()) {
    return [item.img.trim()];
  }

  return [];
}

function normalizeWaitingStatus(value = '') {
  const text = String(value || '').trim();
  return text === LEGACY_STATUS_WAITING ? STATUS_WAITING : text;
}

function computeOrderStatus(goodsList = []) {
  if (!Array.isArray(goodsList) || goodsList.length === 0) {
    return STATUS_PENDING_PICKUP;
  }

  const allPicked = goodsList.every((item) => (
    normalizeWaitingStatus(item.pickupStatus) === STATUS_PICKED ||
    normalizeWaitingStatus(item.pickupStatus) === STATUS_COMPLETED
  ));

  if (allPicked) {
    return STATUS_COMPLETED;
  }

  if (goodsList.some((item) => normalizeWaitingStatus(item.pickupStatus) === STATUS_PENDING_PICKUP)) {
    return STATUS_PENDING_PICKUP;
  }

  if (goodsList.some((item) => normalizeWaitingStatus(item.pickupStatus) === STATUS_WAITING)) {
    return STATUS_WAITING;
  }

  return STATUS_PENDING_PICKUP;
}

function buildGoodsLookup(goodsList = []) {
  const lookup = new Map();

  goodsList.forEach((goods) => {
    const keys = [goods._id, goods.goodsId]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    keys.forEach((key) => {
      lookup.set(key, goods);
    });
  });

  return lookup;
}

async function normalizePreorderGoods() {
  const preorderGoods = await fetchAllByWhere('goods', { type: 'preorder' });
  let updatedCount = 0;

  for (const goods of preorderGoods) {
    const nextData = {};
    let changed = false;

    const canonicalPrice = toSafeNumber(goods.price, toSafeNumber(goods.salePrice, 0));
    if (toSafeNumber(goods.price, NaN) !== canonicalPrice) {
      nextData.price = canonicalPrice;
      changed = true;
    }

    const canonicalCost = toSafeNumber(goods.cost, toSafeNumber(goods.costPrice, 0));
    if (toSafeNumber(goods.cost, NaN) !== canonicalCost) {
      nextData.cost = canonicalCost;
      changed = true;
    }

    const canonicalSpec = getCanonicalSpec(goods);
    if (canonicalSpec && canonicalSpec !== String(goods.specs || '').trim()) {
      nextData.specs = canonicalSpec;
      changed = true;
    }

    const canonicalImages = getCanonicalImages(goods);
    const currentImages = Array.isArray(goods.images) ? goods.images.filter(Boolean) : [];
    if (
      canonicalImages.length > 0 &&
      JSON.stringify(currentImages) !== JSON.stringify(canonicalImages)
    ) {
      nextData.images = canonicalImages;
      changed = true;
    }

    const canonicalGoodsId = String(goods.goodsId || '').trim() || buildGoodsId(goods._id);
    if (canonicalGoodsId !== String(goods.goodsId || '').trim()) {
      nextData.goodsId = canonicalGoodsId;
      changed = true;
    }

    const canonicalCloseAt = normalizeDate(goods.closeAt) || normalizeDate(goods.closedAt);
    if (canonicalCloseAt) {
      if (!isSameDate(goods.closeAt, canonicalCloseAt)) {
        nextData.closeAt = canonicalCloseAt;
        changed = true;
      }
    } else if (hasOwn(goods, 'closeAt') && goods.closeAt !== null) {
      nextData.closeAt = null;
      changed = true;
    }

    const canonicalArrivedAt = normalizeDate(goods.arrivedAt) || normalizeDate(goods.arrivalTime);
    if (canonicalArrivedAt) {
      if (!isSameDate(goods.arrivedAt, canonicalArrivedAt)) {
        nextData.arrivedAt = canonicalArrivedAt;
        changed = true;
      }
    } else if (hasOwn(goods, 'arrivedAt') && goods.arrivedAt === null) {
      nextData.arrivedAt = _.remove();
      changed = true;
    }

    const canonicalStatus = normalizeWaitingStatus(goods.status) === '\u5df2\u5230\u8d27'
      ? '\u5df2\u5230\u8d27'
      : STATUS_WAITING;
    if (canonicalStatus !== goods.status) {
      nextData.status = canonicalStatus;
      changed = true;
    }

    if (hasOwn(goods, 'salePrice')) {
      nextData.salePrice = _.remove();
      changed = true;
    }

    if (hasOwn(goods, 'costPrice')) {
      nextData.costPrice = _.remove();
      changed = true;
    }

    if (hasOwn(goods, 'closedAt')) {
      nextData.closedAt = _.remove();
      changed = true;
    }

    if (hasOwn(goods, 'closeTimeStr')) {
      nextData.closeTimeStr = _.remove();
      changed = true;
    }

    if (hasOwn(goods, 'arrivalTime')) {
      nextData.arrivalTime = _.remove();
      changed = true;
    }

    if (hasOwn(goods, 'spec')) {
      nextData.spec = _.remove();
      changed = true;
    }

    if (hasOwn(goods, 'img') && canonicalImages.length > 0) {
      nextData.img = _.remove();
      changed = true;
    }

    if (!changed) {
      continue;
    }

    await db.collection('goods').doc(goods._id).update({ data: nextData });
    updatedCount += 1;
  }

  return {
    checked: preorderGoods.length,
    updated: updatedCount
  };
}

function normalizeOrderItem(item = {}, goodsLookup) {
  const currentGoodsId = String(item.goodsId || '').trim();
  const currentGoodsDocId = String(item.goodsDocId || '').trim();
  const matchedGoods = goodsLookup.get(currentGoodsId) || goodsLookup.get(currentGoodsDocId) || null;

  if (!matchedGoods) {
    return { item, changed: false };
  }

  const nextItem = { ...item };
  let changed = false;
  const normalizedPickupStatus = normalizeWaitingStatus(item.pickupStatus);

  const canonicalGoodsId = String(matchedGoods.goodsId || '').trim();
  const canonicalGoodsDocId = String(matchedGoods._id || '').trim();
  const canonicalSpec = getCanonicalSpec(matchedGoods);
  const canonicalImages = getCanonicalImages(matchedGoods);
  const canonicalArrivedAt = normalizeDate(matchedGoods.arrivedAt);

  if (!currentGoodsId || currentGoodsId === canonicalGoodsDocId) {
    if (canonicalGoodsId && currentGoodsId !== canonicalGoodsId) {
      nextItem.goodsId = canonicalGoodsId;
      changed = true;
    }
  }

  if (!currentGoodsDocId && canonicalGoodsDocId) {
    nextItem.goodsDocId = canonicalGoodsDocId;
    changed = true;
  }

  if (!String(item.type || '').trim() && matchedGoods.type) {
    nextItem.type = matchedGoods.type;
    changed = true;
  }

  if (!String(item.specs || '').trim() && canonicalSpec) {
    nextItem.specs = canonicalSpec;
    changed = true;
  }

  if (!String(item.name || '').trim() && matchedGoods.name) {
    nextItem.name = matchedGoods.name;
    changed = true;
  }

  if ((!Array.isArray(item.images) || item.images.length === 0) && canonicalImages.length > 0) {
    nextItem.images = canonicalImages;
    changed = true;
  }

  if ((item.price === undefined || item.price === null || Number.isNaN(Number(item.price))) && matchedGoods.price !== undefined) {
    nextItem.price = toSafeNumber(matchedGoods.price, 0);
    changed = true;
  }

  if (
    canonicalArrivedAt &&
    !item.arrivedAt &&
    normalizedPickupStatus !== STATUS_WAITING
  ) {
    nextItem.arrivedAt = canonicalArrivedAt;
    changed = true;
  }

  if (normalizedPickupStatus !== String(item.pickupStatus || '').trim()) {
    nextItem.pickupStatus = normalizedPickupStatus;
    changed = true;
  }

  return { item: nextItem, changed };
}

async function normalizeOrders(goodsLookup) {
  const orders = await fetchAllByWhere('orders', {});
  let updatedCount = 0;

  for (const order of orders) {
    const orderGoods = Array.isArray(order.goods) ? order.goods : [];
    let goodsChanged = false;

    const nextGoods = orderGoods.map((item) => {
      const result = normalizeOrderItem(item, goodsLookup);
      if (result.changed) {
        goodsChanged = true;
      }
      return result.item;
    });

    const canonicalStatus = computeOrderStatus(nextGoods);
    const statusChanged = canonicalStatus !== String(order.status || '').trim();

    if (!goodsChanged && !statusChanged) {
      continue;
    }

    const nextData = {};

    if (goodsChanged) {
      nextData.goods = nextGoods;
    }

    if (statusChanged) {
      nextData.status = canonicalStatus;
    }

    await db.collection('orders').doc(order._id).update({ data: nextData });
    updatedCount += 1;
  }

  return {
    checked: orders.length,
    updated: updatedCount
  };
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const goodsResult = await normalizePreorderGoods();
    const refreshedGoods = await fetchAllByWhere('goods', {});
    const refreshedLookup = buildGoodsLookup(refreshedGoods);
    const ordersResult = await normalizeOrders(refreshedLookup);

    return {
      code: 0,
      message: '\u6570\u636e\u5e93\u4fee\u8ba2\u5b8c\u6210',
      data: {
        goods: goodsResult,
        orders: ordersResult
      }
    };
  } catch (err) {
    console.error('normalizePreorderSchema error', err);
    return {
      code: -1,
      message: err.message || '\u6570\u636e\u5e93\u4fee\u8ba2\u5931\u8d25',
      data: null
    };
  }
};
