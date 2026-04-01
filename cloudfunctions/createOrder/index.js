// 云函数：createOrder
// 目的：创建新订单，并在下单成功时同步扣减 goods 库存。
const cloud = require('wx-server-sdk');

// 如果在云函数中未指定 env，则 auto 选当前环境
cloud.init({ env: 'cloud1-2gltiqs6a2c5cd76' || cloud.DYNAMIC_CURRENT_ENV });

// 判断某个商品是否属于“预定类商品”。
// 预定商品按现有兼容策略先不扣减 stock，避免影响原有预定流程。
function isPreorderGoods(product = {}) {
  const rawType = String(product.type || '').trim().toLowerCase();
  return rawType === 'preorder' || rawType === '预定' || rawType.includes('预定');
}

// 根据订单中传入的 goodsId 查找真实商品。
// 兼容两种情况：
// 1. 新逻辑：orders.goods.goodsId 使用业务字段 goods.goodsId
// 2. 旧逻辑：orders.goods.goodsId 仍然直接存数据库 _id
async function findProductByGoodsId(transaction, goodsId) {
  try {
    const docRes = await transaction.collection('goods').doc(goodsId).get();
    if (docRes && docRes.data) {
      return {
        docId: docRes.data._id || goodsId,
        product: docRes.data
      };
    }
  } catch (err) {
    // 这里不直接抛出，继续尝试按 goodsId 字段查询。
  }

  const queryRes = await transaction.collection('goods')
    .where({ goodsId })
    .limit(1)
    .get();

  const product = (queryRes.data || [])[0];
  if (!product) {
    return null;
  }

  return {
    docId: product._id,
    product
  };
}

exports.main = async (event, context) => {
  const db = cloud.database();
  const _ = db.command;

  try {
    // 接收订单参数
    const { openid, goods, customerInfo, totalPrice, remark, pickupCode } = event;

    // 验证必要参数
    if (!openid) {
      return {
        code: -1,
        message: '缺少用户标识',
        data: null,
      };
    }

    if (!goods || !Array.isArray(goods) || goods.length === 0) {
      return {
        code: -1,
        message: '请选择商品',
        data: null,
      };
    }

    // 生成订单号
    const orderNo = 'ORD' + Date.now() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // 获取用户信息和取货码
    let orderPickupCode = pickupCode;
    let userInfo = {};

    const userResult = await db.collection('users').where({ openid }).get();
    if (userResult.data.length > 0) {
      const user = userResult.data[0];
      // 获取用户信息
      userInfo = {
        avatarUrl: user.avatarUrl || '',
        name: user.nickName || '',
        phone: user.phoneNumber || ''
      };
      // 获取用户的取货码
      if (!orderPickupCode && user.pickupCode) {
        orderPickupCode = user.pickupCode;
      }
    }

    // 如果用户没有取货码，生成一个新的
    if (!orderPickupCode) {
      let hash = 0;
      for (let i = 0; i < openid.length; i++) {
        const char = openid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      orderPickupCode = (Math.abs(hash) % 900000 + 100000).toString();

      // 更新用户的取货码
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          await db.collection('users').where({ openid }).update({
            data: {
              pickupCode: orderPickupCode
            }
          });
          success = true;
        } catch (err) {
          retryCount++;
          console.error(`更新用户取货码失败 (尝试 ${retryCount}/${maxRetries})`, err);
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          }
        }
      }

      if (!success) {
        console.error('更新用户取货码最终失败，超过最大重试次数');
      }
    }

    // 使用事务保证“扣库存 + 创建订单”要么一起成功，要么一起失败。
    const transaction = await db.startTransaction();

    try {
      // 只对非预定商品做库存扣减。
      // 这样可以在不影响现有预定流程的前提下，实现现货/特价商品库存随下单减少。
      for (const item of goods) {
        const goodsId = String(item.goodsId || '').trim();
        const quantity = Number(item.quantity);

        if (!goodsId) {
          throw new Error('存在缺少商品ID的下单项');
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error('商品购买数量不正确');
        }

        const productMatch = await findProductByGoodsId(transaction, goodsId);
        const product = productMatch ? productMatch.product : null;
        const productDocId = productMatch ? productMatch.docId : '';

        if (!product) {
          throw new Error('商品不存在或已下架');
        }

        // 预定商品暂不扣减 stock，保持和现有预定逻辑兼容。
        if (isPreorderGoods(product)) {
          continue;
        }

        const currentStock = Number(product.stock) || 0;
        if (currentStock < quantity) {
          throw new Error(`${product.name || item.name || '商品'}库存不足，当前仅剩${currentStock}件`);
        }

        await transaction.collection('goods').doc(productDocId).update({
          data: {
            stock: _.inc(-quantity),
            updatedAt: new Date()
          }
        });
      }

      // 构建订单数据
      const orderData = {
        orderNo: orderNo,
        openid: openid,
        pickupCode: orderPickupCode,
        goods: goods,
        customerInfo: { ...userInfo, ...customerInfo },
        totalPrice: totalPrice || 0,
        remark: remark || '',
        status: '待取货', // 未到货、待取货、已取货
        paytime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 保存订单到数据库
      const result = await transaction.collection('orders').add({
        data: orderData
      });

      await transaction.commit();

      // 获取完整的订单信息
      const order = await db.collection('orders').doc(result._id).get();

      return {
        code: 0,
        message: '订单创建成功',
        data: order.data,
      };
    } catch (transactionErr) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('createOrder 事务回滚失败', rollbackErr);
      }
      throw transactionErr;
    }
  } catch (err) {
    console.error('createOrder云函数错误', err);
    return {
      code: -1,
      message: err.message || '订单创建失败',
      data: null,
    };
  }
};
