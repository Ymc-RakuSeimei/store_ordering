const cloud = require('wx-server-sdk');
const {
  createModelMessages,
  createIntentUnderstandingMessages,
  detectIntent,
  buildCustomerResult,
  buildMerchantResult,
  matchGoods,
  INTENT_DEFINITIONS,
  detectDataFabrication,
  correctFabricatedAnswer
} = require('./logic');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const PAGE_SIZE = 100;

cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

async function fetchAll(collectionName, whereCondition = {}) {
  try {
    const countRes = await db.collection(collectionName).where(whereCondition).count();
    const total = countRes.total || 0;
    if (!total) return [];

    const tasks = [];
    for (let skip = 0; skip < total; skip += PAGE_SIZE) {
      tasks.push(db.collection(collectionName).where(whereCondition).skip(skip).limit(PAGE_SIZE).get());
    }

    const pages = await Promise.all(tasks);
    return pages.flatMap((page) => page.data || []);
  } catch (error) {
    console.error(`fetchAll ${collectionName} failed:`, error);
    return [];
  }
}

async function getCurrentUser(openid) {
  try {
    const res = await db.collection('users').where({ openid }).limit(1).get();
    return (res.data || [])[0] || null;
  } catch (error) {
    console.error('getCurrentUser failed:', error);
    return null;
  }
}

async function executeMerchantAction(action) {
  if (!action || !action.type) {
    return '';
  }

  try {
    if (action.type === 'update_price') {
      const result = await cloud.callFunction({
        name: 'updateProduct',
        data: {
          id: action.goodsId,
          sellPrice: action.sellPrice,
          costPrice: action.costPrice,
          stock: action.stock,
          description: action.description,
          img: action.img
        }
      });
      if (!result.result || result.result.code !== 0) {
        throw new Error(result.result && result.result.message ? result.result.message : '调价失败');
      }
      return `${action.name}价格已更新为￥${Number(action.sellPrice).toFixed(2)}。`;
    }

    if (action.type === 'toggle_sale') {
      await db.collection('goods').doc(action.goodsId).update({
        data: {
          onStatus: action.onStatus,
          updatedAt: new Date()
        }
      });
      return `${action.name}已${action.onStatus === 'on' ? '上架' : '下架'}。`;
    }

    if (action.type === 'batch_inventory_threshold') {
      const goodsList = await fetchAll('goods');
      await Promise.all(goodsList.map((item) => db.collection('goods').doc(item._id).update({
        data: {
          inventoryAlertThreshold: action.threshold,
          updatedAt: new Date()
        }
      })));
      return `已将${goodsList.length}个商品的库存预警阈值统一设置为${action.threshold}。`;
    }
  } catch (error) {
    console.error('executeMerchantAction failed:', error);
    return `操作失败：${error.message}`;
  }

  return '';
}

async function writeOperationLog(payload) {
  try {
    await db.collection('ai_operation_logs').add({
      data: {
        ...payload,
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('writeOperationLog failed', error);
  }
}

exports.main = async (event = {}, context) => {
  console.log('aiAssistant called with event:', JSON.stringify(event));

  try {
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;

    if (!OPENID) {
      console.error('No OPENID in context');
      return {
        code: -1,
        message: '无法获取用户信息，请重新登录',
        data: null
      };
    }

    // 处理特殊 action：大模型理解后的意图处理
    if (event.action === 'processUnderstoodIntent') {
      return await processUnderstoodIntent(event, context);
    }

    const message = String(event.message || '').trim();
    const history = Array.isArray(event.history) ? event.history : [];

    if (!message) {
      return {
        code: -1,
        message: '消息不能为空',
        data: null
      };
    }

    // 获取当前用户信息
    const user = await getCurrentUser(OPENID);
    // 使用前端传递的 scene 作为角色，而不是用户实际角色
    const role = event.scene === 'merchant' ? 'merchant' : 'customer';

    console.log(`User ${OPENID} role: ${role}, scene: ${event.scene}`);

    // 根据角色获取数据
    // 商家：获取所有数据
    // 顾客：只能获取自己的订单，不能获取其他用户数据
    let goodsList = [];
    let orders = [];
    let feedbacks = [];

    try {
      // 商品列表对所有人可见
      let allGoods = await fetchAll('goods');

      // 对于顾客，只返回正在进行中的接龙活动（与getGoodsList云函数逻辑一致）
      if (role === 'customer') {
        goodsList = allGoods.filter((item) => {
          if (item.type !== 'preorder') {
            return true;
          }

          if (item.preorderState === 'closed') {
            return false;
          }

          if (item.closeType === 'timed' && item.closedAt) {
            const closeAt = new Date(item.closedAt).getTime();
            if (!Number.isNaN(closedAt) && closedAt <= Date.now()) {
              return false;
            }
          }

          return true;
        });
      } else {
        // 商家可以查看所有商品
        goodsList = allGoods;
      }

      if (role === 'merchant') {
        // 商家可以查看所有订单和反馈
        orders = await fetchAll('orders');
        feedbacks = await fetchAll('feedbacks');
      } else {
        // 顾客只能查看自己的订单，从myOrder集合获取
        orders = await fetchAll('orders', { openid: OPENID });
        // 顾客不能查看反馈
        feedbacks = [];
      }

      console.log(`Data fetched - goods: ${goodsList.length}, orders: ${orders.length}, feedbacks: ${feedbacks.length}`);
    } catch (error) {
      console.error('Fetch data failed:', error);
      // 数据获取失败时继续处理，使用空数组
    }

    const contextData = {
      user: user || { openid: OPENID, nickName: '微信用户', pickupCode: '' },
      openid: OPENID,  // 确保openid被传递，用于订单筛选
      goodsList,
      orders,
      feedbacks,
      role  // 传递角色信息用于权限控制
    };

    // 第一步：尝试规则匹配
    let intent = detectIntent(role, message);
    let intentSource = 'rule';

    // 商家特殊意图：查询待取货商品统计
    if (role === 'merchant' && intent === 'merchant_pending_pickup_goods') {
      try {
        // 调用 getMerchantOrderGoods 云函数获取待取货商品列表
        const pickupRes = await cloud.callFunction({
          name: 'getMerchantOrderGoods',
          data: { type: 'pickup' }
        });

        if (pickupRes.result && pickupRes.result.code === 0) {
          const pendingGoods = pickupRes.result.data || [];

          // 构建回复
          let answerDraft = '';
          let contextSummary = '';

          if (pendingGoods.length === 0) {
            answerDraft = '目前没有待取货的商品。所有商品都已取货完成。';
            contextSummary = '待取货商品：无';
          } else {
            answerDraft = `目前有 ${pendingGoods.length} 种商品待取货：\n`;
            contextSummary = `待取货商品统计（共${pendingGoods.length}种）：\n`;

            pendingGoods.forEach((item, index) => {
              answerDraft += `${index + 1}. ${item.name}：还有${item.pickupQty}件待取货\n`;
              contextSummary += `- ${item.name}：待取货${item.pickupQty}件\n`;
            });
          }

          return {
            code: 0,
            message: 'ok',
            data: {
              role,
              intent,
              answerDraft,
              contextSummary,
              suggestions: ['哪些商品低库存', '本周营业额'],
              modelPayload: createModelMessages({
                role,
                userName: contextData.user.nickName,
                message,
                history,
                answerDraft,
                contextSummary,
                suggestions: ['哪些商品低库存', '本周营业额'],
                actionLog: ''
              }),
              actionLog: ''
            }
          };
        }
      } catch (error) {
        console.error('获取待取货商品列表失败:', error);
      }
    }

    // 商家特殊意图：查询特定商品的买家列表
    if (role === 'merchant' && intent === 'merchant_goods_buyers') {
      // 从消息中提取商品名称
      const matchedGoods = matchGoods(message, goodsList);

      if (matchedGoods.length === 0) {
        return {
          code: 0,
          message: 'ok',
          data: {
            role,
            intent,
            answerDraft: '请指定要查询的商品名称，例如"李宁战戟8000还有谁没取货"。',
            contextSummary: '未指定商品名称',
            suggestions: goodsList.slice(0, 3).map(item => `${item.name}还有谁没取货`),
            modelPayload: null,
            actionLog: ''
          }
        };
      }

      const targetGoods = matchedGoods[0];

      try {
        // 调用 getMerchantOrderGoods 云函数获取商品详情（包含买家列表）
        const goodsDetailRes = await cloud.callFunction({
          name: 'getMerchantOrderGoods',
          data: {
            type: 'goodsDetail',
            goodsId: targetGoods.goodsId || targetGoods._id,
            docId: targetGoods._id
          }
        });

        if (goodsDetailRes.result && goodsDetailRes.result.code === 0) {
          const detail = goodsDetailRes.result.data;
          const customers = detail.customers || [];

          // 筛选待取货的买家
          const pendingCustomers = customers.filter(c => c.status === '待取货');

          let answerDraft = '';
          let contextSummary = '';

          if (pendingCustomers.length === 0) {
            answerDraft = `${targetGoods.name} 没有待取货的买家。所有买家都已取货完成。`;
            contextSummary = `${targetGoods.name}：无待取货买家`;
          } else {
            answerDraft = `${targetGoods.name} 还有 ${pendingCustomers.length} 位买家待取货：\n`;
            contextSummary = `${targetGoods.name} 待取货买家（共${pendingCustomers.length}人）：\n`;

            pendingCustomers.forEach((customer, index) => {
              answerDraft += `${index + 1}. ${customer.customerName}  ${customer.phone || '暂无电话'}  待取货${customer.totalQty}件\n`;
              contextSummary += `- ${customer.customerName}（${customer.phone || '暂无电话'}）：${customer.totalQty}件\n`;
            });
          }

          return {
            code: 0,
            message: 'ok',
            data: {
              role,
              intent,
              answerDraft,
              contextSummary,
              suggestions: ['还有哪些货物没取完', '哪些商品低库存'],
              modelPayload: createModelMessages({
                role,
                userName: contextData.user.nickName,
                message,
                history,
                answerDraft,
                contextSummary,
                suggestions: ['还有哪些货物没取完', '哪些商品低库存'],
                actionLog: ''
              }),
              actionLog: ''
            }
          };
        }
      } catch (error) {
        console.error('获取商品买家列表失败:', error);
      }
    }

    // 商家特殊意图：查询超过3天未取货的订单
    if (role === 'merchant' && intent === 'merchant_unpicked') {
      try {
        // 调用 getMerchantOrderGoods 云函数获取待取货商品列表
        const customerListRes = await cloud.callFunction({
          name: 'getMerchantOrderGoods',
          data: { type: 'customer' }
        });

        if (customerListRes.result && customerListRes.result.code === 0) {
          const customerList = customerListRes.result.data || [];
          const deadline = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3天

          // 筛选超过3天未取货的顾客
          const overdueCustomers = customerList.filter(customer => {
            const orderTime = new Date(customer.latestOrderTime).getTime();
            return orderTime <= deadline && customer.pickableQty > 0;
          });

          let answerDraft = '';
          let contextSummary = '';

          if (overdueCustomers.length === 0) {
            answerDraft = '目前没有超过3天未取货的订单。';
            contextSummary = '暂无超3天未取货订单。';
          } else {
            answerDraft = `目前有 ${overdueCustomers.length} 位买家超过3天未取货：\n\n`;
            contextSummary = `超3天未取货顾客（共${overdueCustomers.length}人）：\n`;

            overdueCustomers.forEach((customer, index) => {
              answerDraft += `${index + 1}. ${customer.customerName} ${customer.phone ? `（${customer.phone}）` : ''}\n`;
              answerDraft += `   共有${customer.orderCount}个未取货订单\n`;
              // 简化商品显示格式
              const goodsItems = customer.goodsPreviewText.split('、').filter(Boolean);
              goodsItems.forEach(goods => {
                // 提取商品名称和数量
                const match = goods.match(/(.+?)\s*×(\d+)/);
                if (match) {
                  answerDraft += `   ${match[1].trim()}   ×${match[2]}\n`;
                } else {
                  answerDraft += `   ${goods.trim()}   ×1\n`;
                }
              });
              answerDraft += `\n`;
              contextSummary += `- ${customer.customerName}（${customer.phone || '暂无电话'}）：${customer.pickableQty}件\n`;
            });
          }

          return {
            code: 0,
            message: 'ok',
            data: {
              role,
              intent,
              answerDraft,
              contextSummary,
              suggestions: ['新的售后申请有哪些', '本周营业额'],
              modelPayload: createModelMessages({
                role,
                userName: contextData.user.nickName,
                message,
                history,
                answerDraft,
                contextSummary,
                suggestions: ['新的售后申请有哪些', '本周营业额'],
                actionLog: ''
              }),
              actionLog: ''
            }
          };
        }
      } catch (error) {
        console.error('获取未取货订单列表失败:', error);
      }
    }

    // 第二步：如果规则匹配到默认意图（不确定），使用大模型理解
    // 这样可以处理规则无法覆盖的问法
    if (intent === 'customer_goods_info' || intent === 'merchant_help') {
      try {
        // 调用大模型理解意图
        const intentUnderstandingPayload = createIntentUnderstandingMessages(role, message, history);

        // 这里我们让前端来调用大模型理解意图
        // 返回一个特殊标记，告诉前端需要先理解意图
        return {
          code: 0,
          message: 'ok',
          data: {
            role,
            intent: 'need_intent_understanding',  // 特殊标记
            intentUnderstandingPayload,  // 让大模型理解意图的消息
            originalMessage: message,
            contextData,  // 传递上下文数据
            answerDraft: '',
            contextSummary: '',
            suggestions: [],
            modelPayload: null,
            actionLog: ''
          }
        };
      } catch (error) {
        console.error('意图理解失败，使用默认意图:', error);
        // 失败时继续使用规则匹配的结果
      }
    }

    // 权限检查：如果顾客询问商家专属意图，拒绝回答（不调用AI，直接返回）
    if (role === 'customer' && isMerchantOnlyIntent(intent)) {
      return {
        code: 0,
        message: 'ok',
        data: {
          role,
          intent,
          answerDraft: '抱歉，这个问题需要商家权限才能查看。你可以问我关于商品、订单状态、取货码等问题。',
          contextSummary: '',
          suggestions: ['今天有什么特价商品', '我的取货码是多少', '我的订单状态'],
          modelPayload: null,  // 不调用AI
          actionLog: ''
        }
      };
    }

    const result = role === 'merchant'
      ? buildMerchantResult(intent, message, contextData)
      : buildCustomerResult(intent, message, contextData);

    let actionLog = '';
    if (role === 'merchant' && result.action) {
      actionLog = await executeMerchantAction(result.action);
    }

    const modelPayload = createModelMessages({
      role,
      userName: contextData.user.nickName,
      message,
      history,
      answerDraft: result.answerDraft,
      contextSummary: result.contextSummary,
      suggestions: result.suggestions,
      actionLog
    });

    await writeOperationLog({
      openid: OPENID,
      role,
      intent,
      scene: event.scene || role,
      message,
      action: result.action || null,
      actionLog
    });

    return {
      code: 0,
      message: 'ok',
      data: {
        role,
        intent,
        answerDraft: result.answerDraft,
        contextSummary: result.contextSummary,
        suggestions: result.suggestions || [],
        modelPayload,
        actionLog,
        validationData: {
          role,
          intent,
          originalData: result.answerDraft || result.contextSummary || '',
          contextData
        }
      }
    };
  } catch (error) {
    console.error('aiAssistant error:', error);
    return {
      code: -1,
      message: error.message || 'AI助手暂时不可用，请稍后再试',
      data: null
    };
  }
};

// 检查是否为商家专属意图
function isMerchantOnlyIntent(intent) {
  const merchantOnlyIntents = [
    'merchant_turnover',
    'merchant_preorder_stats',
    'merchant_batch_threshold',
    'merchant_low_stock',
    'merchant_restock',
    'merchant_unpicked',
    'merchant_after_sale',
    'merchant_update_price',
    'merchant_toggle_sale'
  ];
  return merchantOnlyIntents.includes(intent);
}

/**
 * 验证大模型理解的意图是否有效
 * @param {string} understoodIntent - 大模型返回的意图
 * @param {string} role - 用户角色
 * @returns {string} - 验证后的意图
 */
function validateUnderstoodIntent(understoodIntent, role) {
  // 清理意图字符串（去除空格、换行等）
  const cleanIntent = String(understoodIntent || '').trim();

  // 检查意图是否在有效列表中
  const validIntents = Object.keys(INTENT_DEFINITIONS);
  if (validIntents.includes(cleanIntent)) {
    // 检查角色权限
    if (cleanIntent.startsWith(role)) {
      return cleanIntent;
    }
    // 如果是商家意图但用户是买家，返回默认意图
    if (role === 'customer' && cleanIntent.startsWith('merchant')) {
      return 'customer_goods_info';
    }
  }

  // 无效意图，返回默认
  return role === 'merchant' ? 'merchant_help' : 'customer_goods_info';
}

/**
 * 处理大模型理解后的意图
 * 这个函数可以在前端调用大模型后，将结果传回后端处理
 */
async function processUnderstoodIntent(event, context) {
  const wxContext = cloud.getWXContext();
  const OPENID = wxContext.OPENID;

  if (!OPENID) {
    return {
      code: -1,
      message: '无法获取用户信息',
      data: null
    };
  }

  const {
    understoodIntent,  // 大模型理解的意图
    originalMessage,   // 原始用户消息
    contextData,       // 上下文数据
    history            // 对话历史
  } = event;

  // 验证意图
  const validatedIntent = validateUnderstoodIntent(understoodIntent, contextData.role);

  // 构建结果
  const result = contextData.role === 'merchant'
    ? buildMerchantResult(validatedIntent, originalMessage, contextData)
    : buildCustomerResult(validatedIntent, originalMessage, contextData);

  // 执行商家操作（如果有）
  let actionLog = '';
  if (contextData.role === 'merchant' && result.action) {
    actionLog = await executeMerchantAction(result.action);
  }

  // 构建最终的消息
  const modelPayload = createModelMessages({
    role: contextData.role,
    userName: contextData.user.nickName,
    message: originalMessage,
    history,
    answerDraft: result.answerDraft,
    contextSummary: result.contextSummary,
    suggestions: result.suggestions,
    actionLog
  });

  return {
    code: 0,
    message: 'ok',
    data: {
      role: contextData.role,
      intent: validatedIntent,
      answerDraft: result.answerDraft,
      contextSummary: result.contextSummary,
      suggestions: result.suggestions || [],
      modelPayload,
      actionLog
    }
  };
}
