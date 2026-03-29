const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = '/images/goods_sample.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();

function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/');
}

function getProductType(doc = {}) {
  const rawType = String(doc.type || '').trim().toLowerCase();

  if (doc.special === true || rawType === 'special' || rawType === '特价' || rawType.includes('特价')) {
    return 'special';
  }

  if (rawType === 'preorder' || rawType === '预定' || rawType.includes('预定')) {
    return 'preorder';
  }

  return 'stock';
}

function normalizeProduct(doc = {}) {
  const type = getProductType(doc);
  const imageList = Array.isArray(doc.images) ? doc.images.filter(isUsableImage) : [];
  const image = [doc.img, doc.image, imageList[0]].find(isUsableImage) || DEFAULT_PRODUCT_IMAGE;

  return {
    ...doc,
    spec: doc.spec || doc.specs || '',
    specs: doc.specs || doc.spec || '',
    sellPrice: Number(doc.sellPrice ?? doc.price) || 0,
    costPrice: Number(doc.costPrice ?? doc.cost) || 0,
    price: Number(doc.price ?? doc.sellPrice) || 0,
    cost: Number(doc.cost ?? doc.costPrice) || 0,
    stock: Number.isNaN(Number(doc.stock)) ? 0 : Number(doc.stock),
    special: type === 'special',
    type,
    img: image,
    images: imageList.length > 0 ? imageList : [image]
  };
}

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限新增商品');
  }

  return user;
}

function sanitizeProductPayload(event = {}) {
  const name = String(event.name || '').trim();
  const spec = String(event.spec || '').trim();
  const sellPrice = Number(event.sellPrice);
  const costPrice = Number(event.costPrice);
  const stock = Number(event.stock);
  const img = isUsableImage(event.img) ? event.img.trim() : DEFAULT_PRODUCT_IMAGE;

  if (!name) {
    throw new Error('商品名称不能为空');
  }

  if (!spec) {
    throw new Error('商品规格不能为空');
  }

  if (Number.isNaN(sellPrice) || sellPrice < 0) {
    throw new Error('售价格式不正确');
  }

  if (Number.isNaN(costPrice) || costPrice < 0) {
    throw new Error('进价格式不正确');
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error('库存必须为非负整数');
  }

  return {
    name,
    spec,
    specs: spec,
    sellPrice,
    price: sellPrice,
    costPrice,
    cost: costPrice,
    stock,
    special: event.special === true,
    type: event.special === true ? 'special' : 'spot',
    status: '已到货',
    totalBooked: 0,
    description: String(event.description || '').trim(),
    img,
    images: [img]
  };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const payload = sanitizeProductPayload(event);
    const now = new Date();

    const addRes = await db.collection('goods').add({
      data: {
        ...payload,
        createdAt: now,
        updatedAt: now,
        createdBy: OPENID,
        goodsId: ''
      }
    });

    const productRes = await db.collection('goods').doc(addRes._id).get();

    return {
      code: 0,
      message: '添加成功',
      data: {
        product: normalizeProduct(productRes.data)
      }
    };
  } catch (err) {
    console.error('addProduct 云函数错误', err);
    return {
      code: -1,
      message: err.message || '添加商品失败',
      data: null
    };
  }
};
