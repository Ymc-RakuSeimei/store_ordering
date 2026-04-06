const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const STATUS_WAITING = '未到货';
const STATUS_PENDING_PICKUP = '待取货';
const STATUS_ARRIVED = '已到货';
const STATUS_PICKED = '已取货';
const STATUS_COMPLETED = '已完成';

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
  const currentGoodsId = String(item.goodsId || item.goodsDocId || '').trim();
  const targetGoodsId = String(goods.goodsId || '').trim();
  const targetDocId = String(goods._id || '').trim();

  if (!currentGoodsId) {
    return false;
  }

  return currentGoodsId === targetGoodsId || currentGoodsId === targetDocId;
}

function computeOrderStatus(goodsList = []) {
  if (!Array.isArray(goodsList) || goodsList.length === 0) {
    return STATUS_PENDING_PICKUP;
  }

  const hasWaitingArrival = goodsList.some((item) => item.pickupStatus === STATUS_WAITING);
  const hasPendingPickup = goodsList.some((item) => item.pickupStatus === STATUS_PENDING_PICKUP);
  const allPicked = goodsList.every((item) => (
    item.pickupStatus === STATUS_PICKED || item.pickupStatus === STATUS_COMPLETED
  ));

  if (allPicked) {
    return STATUS_COMPLETED;
  }

  if (hasPendingPickup) {
    return STATUS_PENDING_PICKUP;
  }

  if (hasWaitingArrival) {
    return STATUS_WAITING;
  }

  return STATUS_PENDING_PICKUP;
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
    const hasArrivedBefore = goods.status === STATUS_ARRIVED;
    const nextStock = hasArrivedBefore ? (Number(goods.stock) || 0) : totalBooked;

    await db.collection('goods').doc(id).update({
      data: {
        status: STATUS_ARRIVED,
        stock: nextStock,
        arrivedAt: now,
        arrivalTime: now,
        updatedAt: now
      }
    });

    const orderRes = await db.collection('orders').where({
      status: _.in([STATUS_WAITING, STATUS_PENDING_PICKUP, STATUS_ARRIVED])
    }).get();

    const targetOrders = (orderRes.data || []).filter((order) => (
      Array.isArray(order.goods) && order.goods.some((item) => (
        matchesGoods(item, goods) && item.pickupStatus === STATUS_WAITING
      ))
    ));

    await Promise.all(
      targetOrders.map((order) => {
        const nextGoods = (order.goods || []).map((item) => {
          if (!matchesGoods(item, goods) || item.pickupStatus !== STATUS_WAITING) {
            return item;
          }

          return {
            ...item,
            pickupStatus: STATUS_PENDING_PICKUP,
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

    let reminderCount = 0;

    // 只在“第一次到货”时自动提醒，避免重复点击造成消息重复发送。
    if (!hasArrivedBefore && targetOrders.length > 0) {
      try {
        const reminderRes = await cloud.callFunction({
          name: 'sendPickupReminder',
          data: {
            goodsId: goods.goodsId || goods._id,
            goodsName: goods.name || '',
            stock: nextStock
          }
        });

        const reminderResult = reminderRes.result || {};
        if (reminderResult.code === 0) {
          reminderCount = Number(reminderResult.userCount) || 0;
        }
      } catch (reminderError) {
        console.error('sendPickupReminder error', reminderError);
      }
    }

    return {
      code: 0,
      message: '到货成功',
      data: {
        id,
        updatedOrderCount: targetOrders.length,
        reminderCount
      }
    };
  } catch (err) {
    console.error('markPreorderArrived error', err);
    return {
      code: -1,
      message: err.message || '到货失败',
      data: null
    };
  }
};
