const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();

// 判断图片地址是否可以直接给前端展示。
function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://');
}

// 把数据库中的商品类型归一化成前端好判断的值。
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

// 将 goods 集合中的真实字段，映射为商家商品页使用的字段。
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

// 商品修改同样只允许商家操作。
async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限修改商品');
  }

  return user;
}

// 将前端编辑弹窗提交的数据，转成 goods 集合的真实更新字段。
// 这里不再把 sellPrice / costPrice / img 直接写入数据库，
// 而是统一更新成 price / cost / images 这套结构。
function sanitizeUpdatePayload(event = {}, currentProduct = {}) {
  const id = String(event.id || '').trim();

  if (!id) {
    throw new Error('缺少商品ID');
  }

  const sellPrice = Number(event.sellPrice);
  const costPrice = Number(event.costPrice);
  const stock = Number(event.stock);
  const currentImages = Array.isArray(currentProduct.images) ? currentProduct.images.filter(isUsableImage) : [];
  const image = isUsableImage(event.img)
    ? event.img.trim()
    : ([currentProduct.img, currentProduct.image, currentImages[0]].find(isUsableImage) || DEFAULT_PRODUCT_IMAGE);

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
    id,
    updateData: {
      price: sellPrice,
      cost: costPrice,
      stock,
      images: [image],
      updatedAt: new Date()
    }
  };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const id = String(event.id || '').trim();
    if (!id) {
      throw new Error('缺少商品ID');
    }

    const currentRes = await db.collection('goods').doc(id).get();
    const currentProduct = currentRes.data;

    if (!currentProduct) {
      throw new Error('商品不存在');
    }

    const { updateData } = sanitizeUpdatePayload(event, currentProduct);

    await db.collection('goods').doc(id).update({
      data: updateData
    });

    const updatedRes = await db.collection('goods').doc(id).get();

    return {
      code: 0,
      message: '更新成功',
      data: {
        product: normalizeProduct(updatedRes.data)
      }
    };
  } catch (err) {
    console.error('updateProduct 云函数错误', err);
    return {
      code: -1,
      message: err.message || '更新商品失败',
      data: null
    };
  }
};
