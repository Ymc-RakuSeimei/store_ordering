const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = '/images/goods_sample.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();

// 判断图片地址是否可以直接给前端显示。
function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/');
}

// 将数据库中的 type 统一成前端可判断的商品类型。
// 这里保留项目现有的枚举值 spot / preorder / special，
// 这样不会影响顾客端商品页的既有逻辑。
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

// 数据库存真实字段，前端商品管理页使用展示字段。
// 这里把数据库文档转换成前端页面更容易直接渲染的结构。
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

// 只有商家身份才允许新增商品。
async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限新增商品');
  }

  return user;
}

// 将前端传来的新增商品表单，转换为 goods 集合真正落库的字段格式。
// 对齐依据：db-export/goods.json 第一条记录的字段结构。
function sanitizeProductPayload(event = {}) {
  const name = String(event.name || '').trim();
  const spec = String(event.spec || '').trim();
  const sellPrice = Number(event.sellPrice);
  const costPrice = Number(event.costPrice);
  const stock = Number(event.stock);
  const img = isUsableImage(event.img) ? event.img.trim() : DEFAULT_PRODUCT_IMAGE;
  const description = String(event.description || '').trim();
  const type = event.special === true ? 'special' : 'spot';

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
    specs: spec,
    totalBooked: 0,
    images: [img],
    stock,
    type,
    cost: costPrice,
    description,
    price: sellPrice,
    goodsId: '',
    status: '已到货'
  };
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const payload = sanitizeProductPayload(event);
    const now = new Date();

    // 新增时统一补齐创建和更新时间，便于后续排序和排查问题。
    const addRes = await db.collection('goods').add({
      data: {
        ...payload,
        createdAt: now,
        updatedAt: now
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
