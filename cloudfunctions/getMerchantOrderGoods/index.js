const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';
const PAGE_SIZE = 100;

const TXT_WAITING = '\u672a\u5230\u8d27';
const TXT_PENDING_PICKUP = '\u5f85\u53d6\u8d27';
const TXT_ARRIVED = '\u5df2\u5230\u8d27';
const TXT_PICKED = '\u5df2\u53d6\u8d27';
const TXT_COMPLETED = '\u5df2\u5b8c\u6210';
const TXT_PRODUCT = '\u5546\u54c1';
const TXT_CUSTOMER = '\u987e\u5ba2';
const TXT_CUSTOMER_KEY_MISSING = '\u7f3a\u5c11\u987e\u5ba2\u6807\u8bc6';
const TXT_CUSTOMER_NOT_FOUND = '\u672a\u627e\u5230\u987e\u5ba2\u8ba2\u5355';
const TXT_NO_PERMISSION = '\u65e0\u6743\u9650\u8bbf\u95ee\u8ba2\u5355\u5904\u7406';
const TXT_LOAD_FAIL = '\u83b7\u53d6\u5546\u5bb6\u8ba2\u5355\u6570\u636e\u5931\u8d25';
const TXT_SEPARATOR = '\u3001';
const TXT_PREVIEW_SUFFIX = '\u7b49';
const TXT_PREVIEW_GOODS = '\u79cd\u5546\u54c1';
const TXT_ORDER_SUFFIX = '\u7b14\u8ba2\u5355';

const ACTIVE_ORDER_STATUSES = [TXT_WAITING, TXT_PENDING_PICKUP, TXT_ARRIVED];
const PICKED_STATUSES = [TXT_PICKED, TXT_COMPLETED];

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function fetchAllByWhere(collectionName, whereCondition, limit = PAGE_SIZE) {
  const safeLimit = Math.max(1, Math.min(PAGE_SIZE, Number(limit) || PAGE_SIZE));
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

async function assertMerchant(openid) {
  const users = await fetchAllByWhere('users', { openid }, 1);
  const user = users[0] || null;

  if (!user || user.role !== 'merchant') {
    throw new Error(TXT_NO_PERMISSION);
  }

  return user;
}

function chunk(list = [], size = 100) {
  const chunks = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

function toTimestamp(value) {
  if (!value) return 0;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof value === 'object' && value.$date) {
    const timestampFromExport = new Date(value.$date).getTime();
    return Number.isNaN(timestampFromExport) ? 0 : timestampFromExport;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatTime(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const pad = (num) => String(num).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getOrderTime(order = {}) {
  return order.paytime || order.createdAt || order.updatedAt || null;
}

function getCustomerKey(order = {}) {
  return String(order.openid || order.pickupCode || order._id || '').trim();
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

function buildAliasMap(goodsList = []) {
  const aliasMap = {};

  goodsList.forEach((goods) => {
    const canonicalId = String(goods.goodsId || goods._id || '').trim();
    const aliases = [goods.goodsId, goods._id]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    aliases.forEach((key) => {
      aliasMap[key] = canonicalId;
    });
  });

  return aliasMap;
}

async function fetchRelevantOrders() {
  return fetchAllByWhere('orders', {
    status: _.in(ACTIVE_ORDER_STATUSES)
  });
}

async function fetchClosedPreorderGoods() {
  const goodsList = await fetchAllByWhere('goods', {
    type: 'preorder',
    preorderState: 'closed'
  });

  return goodsList.filter((item) => (Number(item.totalBooked) || 0) > 0);
}

async function buildPickupList() {
  const orders = await fetchRelevantOrders();
  if (orders.length === 0) {
    return [];
  }

  const pickupMap = {};

  orders.forEach((order) => {
    const orderTime = getOrderTime(order);
    const goodsList = Array.isArray(order.goods) ? order.goods : [];

    goodsList.forEach((item) => {
      if (item.pickupStatus !== TXT_PENDING_PICKUP) {
        return;
      }

      const goodsKey = String(item.goodsId || item.goodsDocId || item.name || '').trim();
      if (!goodsKey) {
        return;
      }

      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        return;
      }

      if (!pickupMap[goodsKey]) {
        pickupMap[goodsKey] = {
          id: goodsKey,
          goodsId: String(item.goodsId || '').trim() || goodsKey,
          name: item.name || TXT_PRODUCT,
          spec: getGoodsSpec(item),
          img: pickImage(item),
          arrivalDate: '',
          status: TXT_ARRIVED,
          totalQty: 0,
          waitingQty: 0,
          pickupQty: 0,
          pickedQty: 0,
          latestOrderTime: orderTime
        };
      }

      const record = pickupMap[goodsKey];
      record.pickupQty += quantity;
      record.totalQty += quantity;

      if (!record.spec) {
        record.spec = getGoodsSpec(item);
      }

      if (!record.img || record.img === DEFAULT_PRODUCT_IMAGE) {
        record.img = pickImage(item);
      }

      if (toTimestamp(orderTime) >= toTimestamp(record.latestOrderTime)) {
        record.latestOrderTime = orderTime;
      }
    });
  });

  return Object.values(pickupMap)
    .sort((a, b) => toTimestamp(b.latestOrderTime) - toTimestamp(a.latestOrderTime))
    .map((item) => ({
      ...item,
      updatedAt: item.latestOrderTime,
      createdAt: item.latestOrderTime
    }));
}
async function buildPickupOrArrivalList(listType) {
  if (listType === 'pickup') {
    return buildPickupList();
  }

  const preorderGoods = await fetchClosedPreorderGoods();
  if (preorderGoods.length === 0) {
    return [];
  }

  const orders = await fetchRelevantOrders();
  const aliasMap = buildAliasMap(preorderGoods);
  const counters = {};

  preorderGoods.forEach((goods) => {
    const canonicalId = String(goods.goodsId || goods._id || '').trim();
    counters[canonicalId] = {
      waitingQty: 0,
      pickupQty: 0,
      pickedQty: 0
    };
  });

  orders.forEach((order) => {
    (order.goods || []).forEach((item) => {
      const rawGoodsId = String(item.goodsId || '').trim();
      const canonicalId = aliasMap[rawGoodsId];

      if (!canonicalId || !counters[canonicalId]) {
        return;
      }

      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        return;
      }

      if (item.pickupStatus === TXT_WAITING) {
        counters[canonicalId].waitingQty += quantity;
        return;
      }

      if (item.pickupStatus === TXT_PENDING_PICKUP) {
        counters[canonicalId].pickupQty += quantity;
        return;
      }

      if (PICKED_STATUSES.includes(item.pickupStatus)) {
        counters[canonicalId].pickedQty += quantity;
      }
    });
  });

  return preorderGoods
    .map((goods) => {
      const canonicalId = String(goods.goodsId || goods._id || '').trim();
      const summary = counters[canonicalId] || {
        waitingQty: 0,
        pickupQty: 0,
        pickedQty: 0
      };

      return {
        id: goods._id,
        goodsId: goods.goodsId || goods._id,
        name: goods.name || TXT_PRODUCT,
        spec: getGoodsSpec(goods),
        img: pickImage(goods),
        arrivalDate: goods.arrivalDate || '',
        status: goods.status || '',
        totalQty: Number(goods.totalBooked) || 0,
        waitingQty: summary.waitingQty,
        pickupQty: summary.pickupQty,
        pickedQty: summary.pickedQty,
        updatedAt: goods.updatedAt,
        createdAt: goods.createdAt
      };
    })
    .filter((item) => {
      if (listType === 'arrival') {
        return item.waitingQty > 0 && item.status !== TXT_ARRIVED;
      }

      return item.pickupQty > 0 && item.status === TXT_ARRIVED;
    })
    .sort((a, b) => {
      const timeA = toTimestamp(a.updatedAt || a.createdAt);
      const timeB = toTimestamp(b.updatedAt || b.createdAt);
      return timeB - timeA;
    });
}

async function buildUserMap(openids = []) {
  const uniqueOpenids = [...new Set(
    openids
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  )];

  if (uniqueOpenids.length === 0) {
    return {};
  }

  const userMap = {};

  for (const openidChunk of chunk(uniqueOpenids, 100)) {
    const users = await fetchAllByWhere('users', {
      openid: _.in(openidChunk)
    });

    users.forEach((user) => {
      const key = String(user.openid || '').trim();
      if (key) {
        userMap[key] = user;
      }
    });
  }

  return userMap;
}

function buildCustomerDisplayName(order = {}, user = null) {
  const customerInfo = order.customerInfo || {};
  return customerInfo.name || customerInfo.nickName || (user && user.nickName) || TXT_CUSTOMER;
}

function buildCustomerPhone(order = {}, user = null) {
  const customerInfo = order.customerInfo || {};
  return customerInfo.phone || customerInfo.phoneNumber || (user && (user.phoneNumber || user.phone)) || '';
}

function buildCustomerAvatar(order = {}, user = null) {
  const customerInfo = order.customerInfo || {};
  return customerInfo.avatarUrl || (user && user.avatarUrl) || '';
}

function buildGoodsPreviewText(goodsNames = []) {
  const uniqueNames = [...new Set(
    goodsNames
      .map((name) => String(name || '').trim())
      .filter(Boolean)
  )];

  if (uniqueNames.length <= 3) {
    return uniqueNames.join(TXT_SEPARATOR);
  }

  return `${uniqueNames.slice(0, 3).join(TXT_SEPARATOR)} ${TXT_PREVIEW_SUFFIX}${uniqueNames.length}${TXT_PREVIEW_GOODS}`;
}

function buildGoodsLine(item = {}, orderId = '') {
  const quantity = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;

  return {
    id: `${orderId}_${String(item.goodsId || item.name || 'goods').trim()}`,
    goodsId: String(item.goodsId || '').trim(),
    name: item.name || TXT_PRODUCT,
    spec: getGoodsSpec(item),
    qty: quantity,
    price,
    subtotal: Number((quantity * price).toFixed(2)),
    pickupStatus: item.pickupStatus || '',
    img: pickImage(item)
  };
}

async function buildCustomerList() {
  const orders = await fetchRelevantOrders();
  if (orders.length === 0) {
    return [];
  }

  const userMap = await buildUserMap(orders.map((order) => order.openid));
  const groupMap = {};

  orders.forEach((order) => {
    const goodsList = Array.isArray(order.goods) ? order.goods : [];
    const activeGoods = goodsList.filter((item) => (
      item.pickupStatus === TXT_WAITING || item.pickupStatus === TXT_PENDING_PICKUP
    ));

    if (activeGoods.length === 0) {
      return;
    }

    const customerKey = getCustomerKey(order);
    if (!customerKey) {
      return;
    }

    const user = userMap[String(order.openid || '').trim()] || null;
    const orderTime = getOrderTime(order);
    const orderTimeTs = toTimestamp(orderTime);

    if (!groupMap[customerKey]) {
      groupMap[customerKey] = {
        _id: customerKey,
        customerKey,
        customerOpenid: String(order.openid || '').trim(),
        customerName: buildCustomerDisplayName(order, user),
        phone: buildCustomerPhone(order, user),
        avatarUrl: buildCustomerAvatar(order, user),
        pickupCode: String(order.pickupCode || '').trim(),
        orderCount: 0,
        totalQty: 0,
        waitingQty: 0,
        pickableQty: 0,
        totalPrice: 0,
        goodsNames: [],
        latestOrderNo: String(order.orderNo || '').trim(),
        latestOrderTime: orderTime,
        latestOrderTimeTs: orderTimeTs
      };
    }

    const group = groupMap[customerKey];
    group.orderCount += 1;
    group.totalPrice += Number(order.totalPrice) || 0;

    if (!group.phone) {
      group.phone = buildCustomerPhone(order, user);
    }

    if (!group.avatarUrl) {
      group.avatarUrl = buildCustomerAvatar(order, user);
    }

    if (!group.pickupCode) {
      group.pickupCode = String(order.pickupCode || '').trim();
    }

    if (orderTimeTs >= group.latestOrderTimeTs) {
      group.latestOrderTime = orderTime;
      group.latestOrderTimeTs = orderTimeTs;
      group.latestOrderNo = String(order.orderNo || '').trim() || group.latestOrderNo;
    }

    activeGoods.forEach((item) => {
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        return;
      }

      group.totalQty += quantity;
      group.goodsNames.push(item.name || TXT_PRODUCT);

      if (item.pickupStatus === TXT_WAITING) {
        group.waitingQty += quantity;
      }

      if (item.pickupStatus === TXT_PENDING_PICKUP) {
        group.pickableQty += quantity;
      }
    });
  });

  return Object.values(groupMap)
    .filter((item) => item.totalQty > 0)
    .map((item) => ({
      _id: item._id,
      customerKey: item.customerKey,
      customerOpenid: item.customerOpenid,
      customerName: item.customerName || TXT_CUSTOMER,
      phone: item.phone || '',
      avatarUrl: item.avatarUrl || '',
      pickupCode: item.pickupCode || '',
      orderCount: item.orderCount,
      orderNo: item.orderCount > 1 ? `\u5171${item.orderCount}${TXT_ORDER_SUFFIX}` : (item.latestOrderNo || `1${TXT_ORDER_SUFFIX}`),
      latestOrderNo: item.latestOrderNo || '',
      latestOrderTime: item.latestOrderTime || '',
      latestOrderTimeText: formatTime(item.latestOrderTime),
      totalQty: item.totalQty,
      totalPrice: Number(item.totalPrice.toFixed(2)),
      pickableQty: item.pickableQty,
      waitingQty: item.waitingQty,
      arrivalStatus: item.waitingQty > 0 ? 'partial' : 'all',
      goodsPreviewText: buildGoodsPreviewText(item.goodsNames)
    }))
    .sort((a, b) => toTimestamp(b.latestOrderTime) - toTimestamp(a.latestOrderTime));
}

async function buildCustomerDetail(customerKey) {
  if (!customerKey) {
    throw new Error(TXT_CUSTOMER_KEY_MISSING);
  }

  const orders = await fetchRelevantOrders();
  const matchedOrders = orders.filter((order) => getCustomerKey(order) === customerKey);

  if (matchedOrders.length === 0) {
    throw new Error(TXT_CUSTOMER_NOT_FOUND);
  }

  const userMap = await buildUserMap(matchedOrders.map((order) => order.openid));
  const latestOrder = matchedOrders
    .slice()
    .sort((a, b) => toTimestamp(getOrderTime(b)) - toTimestamp(getOrderTime(a)))[0];
  const latestUser = userMap[String(latestOrder.openid || '').trim()] || null;

  const ordersData = matchedOrders
    .map((order) => {
      const goodsList = Array.isArray(order.goods) ? order.goods : [];
      const orderTime = getOrderTime(order);

      return {
        orderId: order._id,
        orderNo: order.orderNo || '\u8ba2\u5355',
        orderTime,
        orderTimeText: formatTime(orderTime),
        pickupCode: order.pickupCode || '',
        totalPrice: Number(Number(order.totalPrice) || 0).toFixed(2),
        remark: String(order.remark || '').trim(),
        goods: goodsList
          .map((item) => buildGoodsLine(item, order._id))
          .filter((item) => item.qty > 0)
      };
    })
    .sort((a, b) => toTimestamp(b.orderTime) - toTimestamp(a.orderTime));

  const totalQty = ordersData.reduce((sum, order) => (
    sum + order.goods.reduce((goodsSum, item) => goodsSum + item.qty, 0)
  ), 0);
  const totalPrice = ordersData.reduce((sum, order) => sum + (Number(order.totalPrice) || 0), 0);

  return {
    customerKey,
    customerName: buildCustomerDisplayName(latestOrder, latestUser),
    phone: buildCustomerPhone(latestOrder, latestUser),
    avatarUrl: buildCustomerAvatar(latestOrder, latestUser),
    pickupCode: latestOrder.pickupCode || '',
    orderCount: ordersData.length,
    totalQty,
    totalPrice: Number(totalPrice.toFixed(2)),
    latestOrderTime: getOrderTime(latestOrder),
    latestOrderTimeText: formatTime(getOrderTime(latestOrder)),
    orders: ordersData
  };
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const listType = String(event.type || 'arrival').trim();
    let data = [];

    if (listType === 'customerDetail') {
      data = await buildCustomerDetail(String(event.customerKey || '').trim());
    } else if (listType === 'customer') {
      data = await buildCustomerList();
    } else {
      data = await buildPickupOrArrivalList(listType === 'pickup' ? 'pickup' : 'arrival');
    }

    return {
      code: 0,
      message: 'ok',
      data
    };
  } catch (err) {
    console.error('getMerchantOrderGoods error', err);
    return {
      code: -1,
      message: err.message || TXT_LOAD_FAIL,
      data: event && event.type === 'customerDetail' ? null : []
    };
  }
};