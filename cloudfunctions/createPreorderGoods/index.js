const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

cloud.init({ env: ENV_ID || cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('\u65e0\u6743\u9650\u521b\u5efa\u63a5\u9f99');
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
    throw new Error('\u5546\u54c1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a');
  }

  if (!spec) {
    throw new Error('\u5546\u54c1\u89c4\u683c\u4e0d\u80fd\u4e3a\u7a7a');
  }

  if (Number.isNaN(salePrice) || salePrice < 0) {
    throw new Error('\u552e\u4ef7\u683c\u5f0f\u4e0d\u6b63\u786e');
  }

  if (Number.isNaN(costPrice) || costPrice < 0) {
    throw new Error('\u8fdb\u4ef7\u683c\u5f0f\u4e0d\u6b63\u786e');
  }

  if (!arrivalDate) {
    throw new Error('\u8bf7\u9009\u62e9\u9884\u8ba1\u5230\u8d27\u65f6\u95f4');
  }

  if (!Number.isInteger(limitPerPerson) || limitPerPerson <= 0) {
    throw new Error('\u6bcf\u4eba\u9650\u8d2d\u5fc5\u987b\u4e3a\u6b63\u6574\u6570');
  }

  if (closeType === 'timed' && !closeTimeStr) {
    throw new Error('\u8bf7\u9009\u62e9\u622a\u5355\u65f6\u95f4');
  }

  let closeAt = null;
  if (closeType === 'timed') {
    const closeDate = new Date(`${arrivalDate}T${closeTimeStr}:00`);
    if (Number.isNaN(closeDate.getTime())) {
      throw new Error('\u622a\u5355\u65f6\u95f4\u683c\u5f0f\u4e0d\u6b63\u786e');
    }
    closeAt = closeDate;
  }

  return {
    name,
    description,
    specs: spec,
    price: salePrice,
    salePrice,
    cost: costPrice,
    costPrice,
    images: [img],
    type: 'preorder',
    status: '\u672a\u5230\u8d27',
    preorderState: 'ongoing',
    stock: 0,
    totalBooked: 0,
    limitPerPerson,
    arrivalDate,
    closeType,
    closeAt,
    goodsId: ''
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

    const generatedGoodsId = buildGoodsId(addRes._id);
    await db.collection('goods').doc(addRes._id).update({
      data: {
        goodsId: generatedGoodsId,
        updatedAt: new Date()
      }
    });

    const productRes = await db.collection('goods').doc(addRes._id).get();

    return {
      code: 0,
      message: '\u521b\u5efa\u6210\u529f',
      data: {
        goods: productRes.data
      }
    };
  } catch (err) {
    console.error('createPreorderGoods error', err);
    return {
      code: -1,
      message: err.message || '\u521b\u5efa\u63a5\u9f99\u5931\u8d25',
      data: null
    };
  }
};