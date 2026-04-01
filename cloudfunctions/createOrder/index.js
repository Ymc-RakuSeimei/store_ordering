// 云函数：createOrder
// 作用：
// 1. 创建顾客订单
// 2. 现货/特价商品下单时扣减库存
// 3. 所有商品下单时累计 goods.totalBooked
// 4. 预定商品写入订单时，商品状态初始化为“未到货”
const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

function normalizeGoodsType(value = '') {
  const rawType = String(value || '').trim().toLowerCase();

  if (rawType === 'preorder' || rawType === '预定' || rawType.includes('预定')) {
    return 'preorder';
  }

  if (rawType === 'special' || rawType === '特价' || rawType.includes('特价')) {
    return 'special';
  }

  return 'spot';
}

function isPreorderGoods(product = {}) {
  return normalizeGoodsType(product.type) === 'preorder';
}

function parseDate(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isClosedPreorder(product = {}) {
  if (!isPreorderGoods(product)) {
    return false;
  }

  if (product.preorderState === 'closed') {
    return true;
  }

  if (product.closeType === 'timed' && parseDate(product.closeAt) > 0) {
    return parseDate(product.closeAt) <= Date.now();
  }

  return false;
}

function buildOrderNo() {
  return `ORD${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

function buildInitialPickupStatus(product = {}) {
  return isPreorderGoods(product) ? '未到货' : '待取货';
}

function buildInitialOrderStatus(orderGoods = []) {
  if (!Array.isArray(orderGoods) || orderGoods.length === 0) {
    return '待取货';
  }

  const statuses = orderGoods.map((item) => item.pickupStatus);
  if (statuses.every((status) => status === '未到货')) {
    return '未到货';
  }

  return '待取货';
}

function buildImages(product = {}, item = {}) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.filter(Boolean);
  }

  if (typeof product.img === 'string' && product.img.trim()) {
    return [product.img.trim()];
  }

  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.filter(Boolean);
  }

  return [];
}

function getProductPrice(product = {}, item = {}) {
  const productType = normalizeGoodsType(product.type);

  if (productType === 'special' && product.specialPrice !== undefined && product.specialPrice !== null) {
    const specialPrice = Number(product.specialPrice);
    if (!Number.isNaN(specialPrice)) {
      return specialPrice;
    }
  }

  const productPrice = Number(product.price);
  if (!Number.isNaN(productPrice)) {
    return productPrice;
  }

  const itemPrice = Number(item.price);
  if (!Number.isNaN(itemPrice)) {
    return itemPrice;
  }

  return 0;
}

async function findProductByGoodsId(transaction, goodsId) {
  try {
    const docRes = await transaction.collection('goods').doc(goodsId).get();
    if (docRes && docRes.data) {
      return {
        docId: docRes.data._id || goodsId,
        product: docRes.data
      };
    }
  } catch (err) {
    // 老数据可能传的是业务 goodsId，因此继续走 where 查询。
  }

  const queryRes = await transaction.collection('goods')
    .where({ goodsId })
    .limit(1)
    .get();

  const product = (queryRes.data || [])[0];
  if (!product) {
    return null;
  }

  return {
    docId: product._id,
    product
  };
}

async function getUserRecord(db, openid) {
  const userResult = await db.collection('users').where({ openid }).limit(1).get();
  return (userResult.data || [])[0] || null;
}

function buildCustomerInfo(user = null, customerInfo = {}) {
  const baseInfo = user
    ? {
        avatarUrl: user.avatarUrl || '',
        name: user.nickName || '',
        phone: user.phoneNumber || user.phone || ''
      }
    : {
        avatarUrl: '',
        name: '',
        phone: ''
      };

  return {
    ...baseInfo,
    ...(customerInfo || {})
  };
}

function buildPickupCodeFromOpenid(openid = '') {
  let hash = 0;
  for (let i = 0; i < openid.length; i += 1) {
    const char = openid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }

  return (Math.abs(hash) % 900000 + 100000).toString();
}

async function ensurePickupCode(db, openid, user = null) {
  if (user && user.pickupCode) {
    return user.pickupCode;
  }

  const pickupCode = buildPickupCodeFromOpenid(openid);
  if (!user) {
    return pickupCode;
  }

  await db.collection('users').doc(user._id).update({
    data: {
      pickupCode,
      updatedAt: new Date()
    }
  });

  return pickupCode;
}

function normalizeOrderItem(product = {}, item = {}, productDocId = '') {
  const quantity = Number(item.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('商品购买数量不正确');
  }

  const limitPerPerson = Number(product.limitPerPerson);
  if (isPreorderGoods(product) && Number.isInteger(limitPerPerson) && limitPerPerson > 0 && quantity > limitPerPerson) {
    throw new Error(`${product.name || '该预定商品'}单次最多预定 ${limitPerPerson} 件`);
  }

  const canonicalGoodsId = String(product.goodsId || product._id || item.goodsId || '').trim();
  if (!canonicalGoodsId) {
    throw new Error('商品索引缺失，无法创建订单');
  }

  return {
    goodsId: canonicalGoodsId,
    goodsDocId: productDocId || product._id || '',
    name: product.name || item.name || '商品',
    price: getProductPrice(product, item),
    quantity,
    pickupStatus: buildInitialPickupStatus(product),
    images: buildImages(product, item),
    type: normalizeGoodsType(product.type),
    specs: product.specs || product.spec || ''
  };
}

exports.main = async (event = {}) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    const openid = String(event.openid || '').trim();
    const orderGoods = Array.isArray(event.goods) ? event.goods : [];
    const customerInfo = event.customerInfo || {};
    const remark = String(event.remark || '').trim();

    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: null
      };
    }

    if (orderGoods.length === 0) {
      return {
        code: -1,
        message: '请选择商品',
        data: null
      };
    }

    const user = await getUserRecord(db, openid);
    const pickupCode = await ensurePickupCode(db, openid, user);
    const transaction = await db.startTransaction();

    try {
      const normalizedGoods = [];

      for (const item of orderGoods) {
        const inputGoodsId = String(item.goodsId || '').trim();
        if (!inputGoodsId) {
          throw new Error('存在缺少商品 ID 的下单项');
        }

        const productMatch = await findProductByGoodsId(transaction, inputGoodsId);
        if (!productMatch || !productMatch.product) {
          throw new Error('商品不存在或已下架');
        }

        const { docId, product } = productMatch;
        const quantity = Number(item.quantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('商品购买数量不正确');
        }

        if (isClosedPreorder(product)) {
          throw new Error(`${product.name || '预定商品'}已截单，无法继续下单`);
        }

        const currentStock = Number(product.stock) || 0;
        const updateData = {
          totalBooked: _.inc(quantity),
          updatedAt: new Date()
        };

        if (!isPreorderGoods(product)) {
          if (currentStock < quantity) {
            throw new Error(`${product.name || item.name || '商品'}库存不足，当前仅剩 ${currentStock} 件`);
          }

          updateData.stock = _.inc(-quantity);
        }

        await transaction.collection('goods').doc(docId).update({
          data: updateData
        });

        normalizedGoods.push(normalizeOrderItem(product, item, docId));
      }

      const totalPrice = normalizedGoods.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
      const now = new Date();
      const orderNo = buildOrderNo();

      const orderData = {
        orderNo,
        openid,
        pickupCode,
        goods: normalizedGoods,
        customerInfo: buildCustomerInfo(user, customerInfo),
        totalPrice,
        remark,
        status: buildInitialOrderStatus(normalizedGoods),
        paytime: now,
        createdAt: now,
        updatedAt: now
      };

      const addRes = await transaction.collection('orders').add({
        data: orderData
      });

      await transaction.commit();

      const createdOrderRes = await db.collection('orders').doc(addRes._id).get();

      return {
        code: 0,
        message: '订单创建成功',
        data: createdOrderRes.data
      };
    } catch (transactionErr) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('createOrder 事务回滚失败', rollbackErr);
      }

      throw transactionErr;
    }
  } catch (err) {
    console.error('createOrder 云函数错误', err);
    return {
      code: -1,
      message: err.message || '订单创建失败',
      data: null
    };
  }
};
