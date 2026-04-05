const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';

cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限执行到货操作');
  }

  return user;
}

function matchesGoods(item = {}, goods = {}) {
  const currentGoodsId = String(item.goodsId || '').trim();
  const targetGoodsId = String(goods.goodsId || '').trim();
  const targetDocId = String(goods._id || '').trim();

  if (!currentGoodsId) {
    return false;
  }

  return currentGoodsId === targetGoodsId || currentGoodsId === targetDocId;
}

function computeOrderStatus(goodsList = []) {
  if (!Array.isArray(goodsList) || goodsList.length === 0) {
    return '待取货';
  }

  const hasWaitingArrival = goodsList.some((item) => item.pickupStatus === '未到货');
  const hasPendingPickup = goodsList.some((item) => item.pickupStatus === '待取货');
  const allPicked = goodsList.every((item) => item.pickupStatus === '已取货' || item.pickupStatus === '已完成');

  if (allPicked) {
    return '已完成';
  }

  if (hasPendingPickup) {
    return '待取货';
  }

  if (hasWaitingArrival) {
    return '未到货';
  }

  return '待取货';
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const id = String(event.id || '').trim();
    if (!id) {
      throw new Error('缺少商品ID');
    }

    const goodsRes = await db.collection('goods').doc(id).get();
    const goods = goodsRes.data;

    if (!goods || goods.type !== 'preorder') {
      throw new Error('预定商品不存在');
    }

    if (goods.preorderState !== 'closed') {
      throw new Error('该接龙尚未截单，不能执行到货');
    }

    const now = new Date();
    const totalBooked = Number(goods.totalBooked) || 0;
    const nextStock = goods.status === '已到货' ? (Number(goods.stock) || 0) : totalBooked;

    await db.collection('goods').doc(id).update({
      data: {
        status: '已到货',
        stock: nextStock,
        arrivedAt: now,
        arrivalTime: now,
        updatedAt: now
      }
    });

    const orderRes = await db.collection('orders').where({
      status: _.in(['未到货', '待取货', '已到货'])
    }).get();

    const targetOrders = (orderRes.data || []).filter((order) =>
      Array.isArray(order.goods) && order.goods.some((item) => matchesGoods(item, goods) && item.pickupStatus === '未到货')
    );

    await Promise.all(
      targetOrders.map((order) => {
        const nextGoods = (order.goods || []).map((item) => {
          if (!matchesGoods(item, goods) || item.pickupStatus !== '未到货') {
            return item;
          }

          return {
            ...item,
            pickupStatus: '待取货',
            arrivedAt: now
          };
        });

        return db.collection('orders').doc(order._id).update({
          data: {
            goods: nextGoods,
            status: computeOrderStatus(nextGoods),
            updatedAt: now
          }
        });
      })
    );

    return {
      code: 0,
      message: '到货成功',
      data: {
        id,
        updatedOrderCount: targetOrders.length
      }
    };
  } catch (err) {
    console.error('markPreorderArrived 云函数错误', err);
    return {
      code: -1,
      message: err.message || '到货失败',
      data: null
    };
  }
};
