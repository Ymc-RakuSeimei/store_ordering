const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const PAGE_SIZE = 100;
const DEFAULT_PRODUCT_IMAGE = '/images/goods_sample.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();

// 判断图片地址是否是可用的展示地址。
function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/');
}

// 将数据库中的 type 统一成前端商品页能直接识别的分类。
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

// 用于按更新时间倒序排序；如果没有 updatedAt，再回退到 createdAt。
function toTimestamp(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// 把 goods 集合中的真实字段映射成商家商品页可直接渲染的字段。
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

// 商家商品管理页只允许商家访问。
async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限访问商品管理');
  }

  return user;
}

// goods 集合可能逐渐变多，这里按分页拉取全部数据，避免一次 limit 不够。
async function fetchAllGoods() {
  const countRes = await db.collection('goods').count();
  const total = countRes.total || 0;

  if (total === 0) {
    return [];
  }

  const tasks = [];
  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection('goods')
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
    );
  }

  const results = await Promise.all(tasks);
  return results.flatMap((item) => item.data || []);
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const items = await fetchAllGoods();
    const sortedItems = items
      .map(normalizeProduct)
      .sort((a, b) => {
        const right = b.updatedAt || b.createdAt;
        const left = a.updatedAt || a.createdAt;
        return toTimestamp(right) - toTimestamp(left);
      });

    const stock = [];
    const special = [];

    // 这个页面只展示现货和特价商品，预定商品仍交给预售页处理。
    sortedItems.forEach((item) => {
      if (item.type === 'preorder') {
        return;
      }

      if (item.special) {
        special.push(item);
        return;
      }

      stock.push(item);
    });

    return {
      code: 0,
      message: 'ok',
      data: {
        stock,
        special
      }
    };
  } catch (err) {
    console.error('fetchGoods 云函数错误', err);
    return {
      code: -1,
      message: err.message || '获取商品列表失败',
      data: null
    };
  }
};
