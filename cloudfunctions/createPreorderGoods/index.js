const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限创建接龙');
  }

  return user;
}

function buildGoodsId(docId = '') {
  return `GD_${String(docId).toUpperCase()}`;
}

function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://');
}

function parseCloseAt(arrivalDate, closeType, closeTimeStr) {
  if (closeType !== 'timed') {
    return null;
  }

  if (!closeTimeStr) {
    throw new Error('请选择截单时间');
  }

  const closeDate = new Date(`${arrivalDate}T${closeTimeStr}:00`);
  if (Number.isNaN(closeDate.getTime())) {
    throw new Error('截单时间格式不正确');
  }

  return closeDate;
}

function sanitizePayload(event = {}) {
  const name = String(event.name || '').trim();
  const description = String(event.description || '').trim();
  const spec = String(event.spec || '').trim();
  const salePrice = Number(event.salePrice);
  const costPrice = Number(event.costPrice);
  const limitPerPerson = Number(event.limitPerPerson);
  const arrivalDate = String(event.arrivalDate || '').trim();
  const closeType = event.closeType === 'timed' ? 'timed' : 'manual';
  const closeTimeStr = String(event.closeTimeStr || '').trim();
  const img = isUsableImage(event.img) ? event.img.trim() : DEFAULT_PRODUCT_IMAGE;

  if (!name) {
    throw new Error('商品名称不能为空');
  }

  if (!spec) {
    throw new Error('商品规格不能为空');
  }

  if (Number.isNaN(salePrice) || salePrice < 0) {
    throw new Error('售价格式不正确');
  }

  if (Number.isNaN(costPrice) || costPrice < 0) {
    throw new Error('进价格式不正确');
  }

  if (!arrivalDate) {
    throw new Error('请选择预计到货时间');
  }

  if (!Number.isInteger(limitPerPerson) || limitPerPerson <= 0) {
    throw new Error('每人限购必须为正整数');
  }

  return {
    name,
    description,
    specs: spec,
    price: salePrice,
    cost: costPrice,
    images: [img],
    type: 'preorder',
    status: '未到货',
    preorderState: 'ongoing',
    stock: 0,
    totalBooked: 0,
    limitPerPerson,
    arrivalDate,
    closeType,
    closeAt: parseCloseAt(arrivalDate, closeType, closeTimeStr)
  };
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const payload = sanitizePayload(event);
    const now = new Date();

    const addRes = await db.collection('goods').add({
      data: {
        ...payload,
        createdAt: now,
        updatedAt: now,
        createdBy: OPENID
      }
    });

    const goodsId = buildGoodsId(addRes._id);

    await db.collection('goods').doc(addRes._id).update({
      data: {
        goodsId,
        updatedAt: new Date()
      }
    });

    const productRes = await db.collection('goods').doc(addRes._id).get();

    return {
      code: 0,
      message: '创建成功',
      data: {
        goods: productRes.data
      }
    };
  } catch (err) {
    console.error('createPreorderGoods error', err);
    return {
      code: -1,
      message: err.message || '创建接龙失败',
      data: null
    };
  }
};
