const cloud = require('wx-server-sdk');

cloud.init();

const db = cloud.database();

const STATUS_WAITING = '\u672a\u5230\u8d27';
const STATUS_PENDING_PICKUP = '\u5f85\u53d6\u8d27';
const STATUS_PICKED = '\u5df2\u53d6\u8d27';
const STATUS_COMPLETED = '\u5df2\u5b8c\u6210';

function parseOrderGoodsKey(compoundKey = '') {
  const separatorIndex = typeof compoundKey === 'string' ? compoundKey.indexOf('_') : -1;

  if (separatorIndex <= 0) {
    return { orderId: '', itemGoodsId: '' };
  }

  return {
    orderId: compoundKey.slice(0, separatorIndex),
    itemGoodsId: compoundKey.slice(separatorIndex + 1)
  };
}

function computeOrderStatus(goodsList = []) {
  if (!Array.isArray(goodsList) || goodsList.length === 0) {
    return STATUS_PENDING_PICKUP;
  }

  const allPicked = goodsList.every((item) => (
    item.pickupStatus === STATUS_PICKED || item.pickupStatus === STATUS_COMPLETED
  ));

  if (allPicked) {
    return STATUS_COMPLETED;
  }

  if (goodsList.some((item) => item.pickupStatus === STATUS_PENDING_PICKUP)) {
    return STATUS_PENDING_PICKUP;
  }

  if (goodsList.some((item) => item.pickupStatus === STATUS_WAITING)) {
    return STATUS_WAITING;
  }

  return STATUS_PENDING_PICKUP;
}

async function findGoodsRecord(item = {}) {
  const goodsDocId = String(item.goodsDocId || '').trim();
  const goodsId = String(item.goodsId || '').trim();

  if (goodsDocId) {
    try {
      const docRes = await db.collection('goods').doc(goodsDocId).get();
      if (docRes && docRes.data) {
        return docRes.data;
      }
    } catch (error) {
      // 如果 goodsDocId 是历史无效值，再按 goodsId 查询。
    }
  }

  if (!goodsId) {
    return null;
  }

  const queryRes = await db.collection('goods').where({ goodsId }).limit(1).get();
  return (queryRes.data || [])[0] || null;
}

async function syncPreorderStock(item = {}, pickedAt) {
  if (String(item.type || '').trim() !== 'preorder') {
    return;
  }

  const quantity = Number(item.quantity) || 0;
  if (quantity <= 0) {
    return;
  }

  const goodsRecord = await findGoodsRecord(item);
  if (!goodsRecord || !goodsRecord._id) {
    return;
  }

  const currentStock = Number(goodsRecord.stock) || 0;
  const nextStock = Math.max(currentStock - quantity, 0);

  await db.collection('goods').doc(goodsRecord._id).update({
    data: {
      stock: nextStock,
      updatedAt: pickedAt
    }
  });
}

exports.main = async (event = {}) => {
  try {
    const { pickupCode, goodsIds } = event;

    if (!pickupCode || !Array.isArray(goodsIds) || goodsIds.length === 0) {
      return {
        code: -1,
        message: '\u53c2\u6570\u9519\u8bef'
      };
    }

    const updatePromises = goodsIds.map(async (compoundKey) => {
      const { orderId, itemGoodsId } = parseOrderGoodsKey(compoundKey);

      if (!orderId || !itemGoodsId) {
        return { success: false, goodsId: compoundKey, error: '\u65e0\u6548\u7684\u5546\u54c1ID' };
      }

      try {
        const orderRes = await db.collection('orders').doc(orderId).get();
        const order = orderRes.data;

        if (!order) {
          return { success: false, goodsId: compoundKey, error: '\u8ba2\u5355\u4e0d\u5b58\u5728' };
        }

        if (String(order.pickupCode || '').trim() !== String(pickupCode).trim()) {
          return { success: false, goodsId: compoundKey, error: '\u53d6\u8d27\u7801\u4e0d\u5339\u914d' };
        }

        const goodsList = Array.isArray(order.goods) ? order.goods : [];
        const goodsIndex = goodsList.findIndex((item) => String(item.goodsId || '').trim() === itemGoodsId);

        if (goodsIndex === -1) {
          return { success: false, goodsId: compoundKey, error: '\u5546\u54c1\u4e0d\u5728\u8ba2\u5355\u4e2d' };
        }

        const currentItem = goodsList[goodsIndex];
        if (currentItem.pickupStatus === STATUS_PICKED || currentItem.pickupStatus === STATUS_COMPLETED) {
          return { success: false, goodsId: compoundKey, error: '\u5546\u54c1\u5df2\u53d6\u8d27' };
        }

        const pickedAt = new Date();
        const nextGoods = goodsList.map((item, index) => {
          if (index !== goodsIndex) {
            return item;
          }

          return {
            ...item,
            pickupStatus: STATUS_PICKED,
            pickuptime: pickedAt
          };
        });

        await syncPreorderStock(currentItem, pickedAt);

        const updateRes = await db.collection('orders').doc(orderId).update({
          data: {
            goods: nextGoods,
            status: computeOrderStatus(nextGoods),
            updatedAt: pickedAt
          }
        });

        if (updateRes.stats && updateRes.stats.updated > 0) {
          return { success: true, goodsId: compoundKey };
        }

        return { success: false, goodsId: compoundKey, error: '\u66f4\u65b0\u5931\u8d25' };
      } catch (err) {
        console.error('pickupGoods item error', compoundKey, err);
        return { success: false, goodsId: compoundKey, error: err.message || '\u66f4\u65b0\u5931\u8d25' };
      }
    });

    const results = await Promise.all(updatePromises);
    const success = results.filter((item) => item.success).map((item) => item.goodsId);
    const failed = results.filter((item) => !item.success);

    if (failed.length > 0 && success.length > 0) {
      return {
        code: 0,
        message: `\u90e8\u5206\u5546\u54c1\u53d6\u8d27\u6210\u529f\uff0c${failed.length}\u4e2a\u5546\u54c1\u5931\u8d25`,
        data: { success, failed }
      };
    }

    if (failed.length > 0) {
      return {
        code: -1,
        message: `\u53d6\u8d27\u5931\u8d25: ${failed[0].error || '\u672a\u77e5\u9519\u8bef'}`,
        data: { failed }
      };
    }

    return {
      code: 0,
      message: '\u53d6\u8d27\u6210\u529f',
      data: { success }
    };
  } catch (err) {
    console.error('pickupGoods error', err);
    return {
      code: -1,
      message: `\u53d6\u8d27\u5931\u8d25: ${err.message || '\u672a\u77e5\u9519\u8bef'}`
    };
  }
};
