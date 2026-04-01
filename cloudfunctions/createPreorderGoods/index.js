const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const DEFAULT_PRODUCT_IMAGE = '/images/goods_sample.png';

cloud.init({ env: ENV_ID });

const db = cloud.database();

// 只允许商家创建接龙商品。
async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限创建接龙');
  }

  return user;
}

// 复用商品侧的业务唯一标识规则。
function buildGoodsId(docId = '') {
  return `GD_${String(docId).toUpperCase()}`;
}

function isUsableImage(value) {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/');
}

// 将“创建接龙”表单数据整理成 goods 集合落库格式。
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

  if (closeType === 'timed' && !closeTimeStr) {
    throw new Error('请选择截单时间');
  }

  let closeAt = null;
  if (closeType === 'timed') {
    const closeDate = new Date(`${arrivalDate}T${closeTimeStr}:00`);
    if (Number.isNaN(closeDate.getTime())) {
      throw new Error('截单时间格式不正确');
    }
    closeAt = closeDate;
  }

  return {
    name,
    description,
    specs: spec,
    price: salePrice,
    cost: costPrice,
    images: [img],
    type: 'preorder',
    // 预定商品创建时整体状态默认未到货。
    status: '未到货',
    // 进行中 / 已截单，用于商家预售页和买家端是否可见。
    preorderState: 'ongoing',
    // 按你确认的规则，预定商品初始库存固定为 0。
    stock: 0,
    totalBooked: 0,
    limitPerPerson,
    arrivalDate,
    closeType,
    closeTimeStr,
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
      message: '创建成功',
      data: {
        goods: productRes.data
      }
    };
  } catch (err) {
    console.error('createPreorderGoods 云函数错误', err);
    return {
      code: -1,
      message: err.message || '创建接龙失败',
      data: null
    };
  }
};
