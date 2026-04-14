/**
 * AI助手云函数主入口
 * 负责处理AI助手的核心逻辑，包括数据查询、意图识别、操作执行和回复生成
 * 
 * 核心功能：
 * 1. 处理用户输入的自然语言查询
 * 2. 基于规则和大模型进行意图识别
 * 3. 根据用户角色（买家/商家）提供不同的功能
 * 4. 执行商家操作（如改价、上下架、设置库存预警）
 * 5. 生成智能回复并调用大模型进行优化
 * 6. 检测和修正大模型可能的幻觉
 */

const cloud = require('wx-server-sdk');
const {
  createModelMessages,         // 创建大模型消息格式
  createIntentUnderstandingMessages, // 创建意图理解消息
  detectIntent,                // 基于规则检测用户意图
  buildCustomerResult,         // 构建买家回复结果
  buildMerchantResult,         // 构建商家回复结果
  matchGoods,                  // 匹配商品
  INTENT_DEFINITIONS,          // 意图定义和说明
  detectDataFabrication,       // 检测数据编造
  correctFabricatedAnswer      // 修正编造的答案
} = require('./logic');

// 云环境ID
const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
// 数据库查询页大小
const PAGE_SIZE = 100;

// 初始化云环境
cloud.init({ env: ENV_ID });

const db = cloud.database();
const _ = db.command;

/**
 * 商家敏感意图集合
 * 这些意图涉及商家核心经营数据，需要特殊处理
 */
const MERCHANT_SENSITIVE_INTENTS = new Set([
  'merchant_stock_goods',       // 现货商品列表
  'merchant_special_goods',     // 特价商品列表
  'merchant_preorder_overview', // 预售/接龙概览
  'merchant_turnover',          // 营业额查询
  'merchant_preorder_stats',    // 接龙统计
  'merchant_unpicked',          // 未取货订单
  'merchant_pending_pickup_goods', // 待取货商品
  'merchant_goods_buyers',      // 商品买家列表
  'merchant_after_sale'         // 售后申请
]);

/**
 * 批量获取数据库数据
 * @param {string} collectionName - 集合名称
 * @param {Object} whereCondition - 查询条件
 * @returns {Promise<Array>} - 查询结果
 */
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

/**
 * 获取当前用户信息
 * @param {string} openid - 用户openid
 * @returns {Promise<Object|null>} - 用户信息
 */
async function getCurrentUser(openid) {
  try {
    const res = await db.collection('users').where({ openid }).limit(1).get();
    return (res.data || [])[0] || null;
  } catch (error) {
    console.error('getCurrentUser failed:', error);
    return null;
  }
}

/**
 * 执行商家操作
 * @param {Object} action - 操作对象
 * @returns {string} - 操作结果
 */
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
      const stock = action.onStatus === 'on' ? 999 : 0; 
      await db.collection('goods').doc(action.goodsId).update({
        data: {
          stock: stock,
          updatedAt: new Date()
        }
      });
      return `${action.name}已${action.onStatus === 'on' ? '上架' : '下架'}。`;
    }

    if (action.type === 'batch_inventory_threshold') {
      return `已将库存预警阈值统一设置为${action.threshold}。`;
    }
  } catch (error) {
    console.error('executeMerchantAction failed:', error);
    return `操作失败：${error.message}`;
  }

  return '';
}

/**
 * 记录AI操作日志
 * @param {Object} payload - 操作日志
 */
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

function shouldBypassModel(role, intent) {
  return role === 'merchant' && MERCHANT_SENSITIVE_INTENTS.has(intent);
}

async function callMerchantOrderGoods(type, data = {}) {
  const res = await cloud.callFunction({
    name: 'getMerchantOrderGoods',
    data: { type, ...data }
  });
  if (!res.result || res.result.code !== 0) {
    throw new Error((res.result && res.result.message) || '获取订单数据失败');
  }
  return res.result.data || [];
}

function formatPendingCustomerOrders(customerList = []) {
  const pendingCustomers = customerList.filter((customer) => Number(customer.pickableQty || 0) > 0);
  if (pendingCustomers.length === 0) {
    return {
      answerDraft: '目前没有未取货的订单。',
      contextSummary: '暂无未取货订单。'
    };
  }

  let answerDraft = '以下买家有货品还没有取，详情如下\n\n';
  let contextSummary = '未取货订单：\n';
  pendingCustomers.forEach((customer) => {
    answerDraft += `${customer.customerName}  ${customer.phone || '暂无电话'} 取货码:${customer.pickupCode || '暂无'}\n`;
    const goodsItems = String(customer.goodsPreviewText || '').split('、').filter(Boolean);
    goodsItems.forEach((goods) => {
      const match = goods.match(/(.+?)\s*×(\d+)/);
      if (match) {
        answerDraft += `${match[1].trim()}   ×${match[2]}\n`;
      } else {
        answerDraft += `${goods.trim()}   ×1\n`;
      }
    });
    answerDraft += '\n';
    contextSummary += `- ${customer.customerName}（${customer.phone || '暂无电话'}）：${customer.pickableQty}件\n`;
  });

  return { answerDraft, contextSummary };
}

async function callFetchGoods() {
  const res = await cloud.callFunction({ name: 'fetchGoods', data: {} });
  if (!res.result || res.result.code !== 0) {
    throw new Error((res.result && res.result.message) || '获取商品列表失败');
  }
  const payload = res.result.data || {};
  return {
    stock: Array.isArray(payload.stock) ? payload.stock : [],
    special: Array.isArray(payload.special) ? payload.special : []
  };
}

async function callFetchPreorderList() {
  const res = await cloud.callFunction({ name: 'fetchPreorderList', data: {} });
  if (!res.result || res.result.code !== 0) {
    throw new Error((res.result && res.result.message) || '获取接龙列表失败');
  }
  const payload = res.result.data || {};
  return {
    current: Array.isArray(payload.current) ? payload.current : [],
    completed: Array.isArray(payload.completed) ? payload.completed : []
  };
}

async function callFetchPreorderDetail(goodsId) {
  const res = await cloud.callFunction({
    name: 'fetchPreorderOrders',
    data: { goodsId }
  });
  if (!res.result || res.result.code !== 0) {
    throw new Error((res.result && res.result.message) || '获取接龙详情失败');
  }
  return (res.result.data && res.result.data.goods) || null;
}

/**
 * 云函数主入口
 * @param {Object} event - 事件对象，包含消息内容、历史记录等
 * @param {Object} context - 上下文对象，包含用户信息
 * @returns {Object} - 响应结果，包含AI回复和相关数据
 * 
 * 处理流程：
 * 1. 获取用户信息和验证
 * 2. 处理特殊操作（如意图理解）
 * 3. 获取用户角色和数据
 * 4. 规则匹配意图
 * 5. 处理商家特殊意图（调用对应云函数获取数据）
 * 6. 大模型意图理解（当规则匹配不确定时）
 * 7. 权限检查
 * 8. 构建回复结果
 * 9. 执行商家操作
 * 10. 调用大模型优化回复
 * 11. 记录操作日志
 * 12. 返回结果
 */
exports.main = async (event = {}, context) => {
  console.log('aiAssistant called with event:', JSON.stringify(event));

  try {
    // 获取用户OPENID
    const wxContext = cloud.getWXContext();
    const OPENID = wxContext.OPENID;

    // 验证用户身份
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

    // 提取消息和历史记录
    const message = String(event.message || '').trim();
    const history = Array.isArray(event.history) ? event.history : [];

    // 验证消息不为空
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

          if (item.closeType === 'timed' && item.closeAt) {
            const closeAt = new Date(item.closeAt).getTime();
            if (!Number.isNaN(closeAt) && closeAt <= Date.now()) {
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
        // 顾客只能查看自己的订单
        orders = await fetchAll('orders', { openid: OPENID });
        // 顾客不能查看反馈
        feedbacks = [];
      }

      console.log(`Data fetched - goods: ${goodsList.length}, orders: ${orders.length}, feedbacks: ${feedbacks.length}`);
    } catch (error) {
      console.error('Fetch data failed:', error);
      // 数据获取失败时继续处理，使用空数组
    }

    // 构建上下文数据
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

    // 商家特殊意图：现货/特价商品列表
    if (role === 'merchant' && (intent === 'merchant_stock_goods' || intent === 'merchant_special_goods')) {
      try {
        const goodsData = await callFetchGoods();
        const list = intent === 'merchant_stock_goods' ? goodsData.stock : goodsData.special;
        const label = intent === 'merchant_stock_goods' ? '现货' : '特价';
        if (!list.length) {
          return {
            code: 0,
            message: 'ok',
            data: {
              role,
              intent,
              answerDraft: `当前没有可售${label}商品。`,
              contextSummary: `商家商品管理-${label}列表为空。`,
              suggestions: intent === 'merchant_stock_goods' ? ['特价商品有哪些', '哪些商品低库存'] : ['现货商品有哪些', '本周营业额'],
              modelPayload: null,
              actionLog: '',
              forceUseDraft: true
            }
          };
        }
        const lines = list.slice(0, 20).map((item, index) => (
          `${index + 1}. ${item.name || '商品'}\n` +
          `   规格：${item.specs || '默认'}\n` +
          `   售价：￥${Number(item.price ?? 0).toFixed(2)}  进价：￥${Number(item.cost ?? 0).toFixed(2)}\n` +
          `   库存：${Number(item.stock || 0)}件`
        ));
        return {
          code: 0,
          message: 'ok',
          data: {
            role,
            intent,
            answerDraft: `以下是商家商品管理页中的${label}商品：\n\n${lines.join('\n\n')}`,
            contextSummary: `${label}商品共${list.length}个（展示前20个）。`,
            suggestions: intent === 'merchant_stock_goods' ? ['特价商品有哪些', '哪些商品低库存'] : ['现货商品有哪些', '本周营业额'],
            modelPayload: null,
            actionLog: '',
            forceUseDraft: true
          }
        };
      } catch (error) {
        console.error('获取商家商品管理列表失败，降级到数据库:', error);
      }
    }

    // 商家特殊意图：预售/接龙概览
    if (role === 'merchant' && intent === 'merchant_preorder_overview') {
      try {
        const preorderData = await callFetchPreorderList();
        const current = preorderData.current || [];
        const completed = preorderData.completed || [];
        const currentLines = current.slice(0, 10).map((item, index) =>
          `${index + 1}. ${item.name || '商品'}（规格：${item.spec || '默认'}，已订${Number(item.totalQty || 0)}件，预计到货：${item.arrivalDate || '待定'}）`
        );
        const completedLines = completed.slice(0, 10).map((item, index) =>
          `${index + 1}. ${item.name || '商品'}（规格：${item.spec || '默认'}，已订${Number(item.totalQty || 0)}件，截止：${item.closedAt || '未记录'}）`
        );

        const allPreorder = current.concat(completed);
        const target = allPreorder.find((item) => message.includes(String(item.name || '')));
        let detailLine = '';
        if (target && (target.goodsId || target.id)) {
          try {
            const detail = await callFetchPreorderDetail(target.goodsId || target.id);
            if (detail) {
              detailLine = `\n\n补充（接龙详情页）：${detail.name || target.name} 参与人数${Number(detail.participantCount || 0)}，总订件数${Number(detail.totalQty || 0)}，状态${detail.preorderState === 'closed' ? '已截止' : '进行中'}。`;
            }
          } catch (error) {
            console.error('获取接龙详情补充信息失败:', error);
          }
        }

        return {
          code: 0,
          message: 'ok',
          data: {
            role,
            intent,
            answerDraft: [
              `正在接龙：${current.length}个`,
              current.length ? currentLines.join('\n') : '暂无进行中的接龙商品',
              '',
              `已截止：${completed.length}个`,
              completed.length ? completedLines.join('\n') : '暂无已截止接龙商品',
              detailLine
            ].filter(Boolean).join('\n'),
            contextSummary: `商家预售订货页：进行中${current.length}个，已截止${completed.length}个。`,
            suggestions: ['接龙统计', '现货商品有哪些'],
            modelPayload: null,
            actionLog: '',
            forceUseDraft: true
          }
        };
      } catch (error) {
        console.error('获取商家预售订货列表失败，降级到数据库:', error);
      }
    }

    // 商家特殊意图：查询所有未取货订单（严格复用订单处理-顾客订单逻辑）
    if (role === 'merchant' && intent === 'merchant_pending_pickup_goods') {
      try {
        const customerList = await callMerchantOrderGoods('customer');
        const { answerDraft, contextSummary } = formatPendingCustomerOrders(customerList);
        return {
          code: 0,
          message: 'ok',
          data: {
            role,
            intent,
            answerDraft,
            contextSummary,
            suggestions: ['超过3天未取货有哪些', '本周营业额'],
            modelPayload: null,
            actionLog: '',
            forceUseDraft: true
          }
        };
      } catch (error) {
        console.error('通过订单处理页面逻辑获取未取货订单失败，降级到数据库:', error);
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
            answerDraft: '请指定要查询的商品名称，例如"水果玉米还有谁没取货"。',
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
            // 按照要求的格式构建回复
            answerDraft = pendingCustomers.map((customer) => `${customer.customerName} ${customer.phone || '暂无电话'} 还有${customer.totalQty}件${targetGoods.name}未取`).join('；');
            contextSummary = pendingCustomers.map((customer) => `${customer.customerName}（${customer.phone || '暂无电话'}）：${customer.totalQty}件`).join('；');
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
              modelPayload: null,
              actionLog: '',
              forceUseDraft: true
            }
          };
        }
      } catch (error) {
        console.error('获取商品买家列表失败，使用本地订单数据处理:', error);

        // 使用本地订单数据进行处理作为备份方案
        const customerMap = {};

        orders.forEach((order) => {
          (Array.isArray(order.goods) ? order.goods : []).forEach((item) => {
            if (String(item.goodsId || '') === String(targetGoods.goodsId || targetGoods._id) && item.pickupStatus === '待取货') {
              const customerName = (order.customerInfo && order.customerInfo.name) || '未知顾客';
              const customerPhone = (order.customerInfo && order.customerInfo.phone) || '暂无电话';
              const quantity = Number(item.quantity || 0);

              if (!customerMap[customerName]) {
                customerMap[customerName] = {
                  name: customerName,
                  phone: customerPhone,
                  quantity: 0
                };
              }
              customerMap[customerName].quantity += quantity;
            }
          });
        });

        const customers = Object.values(customerMap);
        let answerDraft = '';
        let contextSummary = '';

        if (customers.length === 0) {
          answerDraft = `目前没有关于"${targetGoods.name}"的未取货订单记录。`;
          contextSummary = `暂无${targetGoods.name}的未取货订单。`;
        } else {
          // 按照要求的格式构建回复
          answerDraft = customers.map((customer) => `${customer.name} ${customer.phone} 还有${customer.quantity}件${targetGoods.name}未取`).join('；');
          contextSummary = customers.map((customer) => `${customer.name}（${customer.phone}）：${customer.quantity}件`).join('；');
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
            modelPayload: null,
            actionLog: '',
            forceUseDraft: true
          }
        };
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
              modelPayload: null,
              actionLog: '',
              forceUseDraft: true
            }
          };
        }
      } catch (error) {
        console.error('获取未取货订单列表失败:', error);
      }
    }

    // 商家特殊意图回退：无法复用页面云函数时，直接查订单库
    if (role === 'merchant' && intent === 'merchant_pending_pickup_goods') {
      const results = contextData.orders.filter((order) => /待取货/.test(String(order.status || '')));
      const customerMap = {};
      results.forEach((order) => {
        const customerName = (order.customerInfo && order.customerInfo.name) || '未知顾客';
        const customerPhone = (order.customerInfo && order.customerInfo.phone) || '暂无电话';
        const pickupCode = order.pickupCode || '暂无';
        if (!customerMap[customerName]) {
          customerMap[customerName] = { name: customerName, phone: customerPhone, pickupCode, goods: [] };
        }
        (Array.isArray(order.goods) ? order.goods : []).forEach((item) => {
          if (item.pickupStatus === '待取货') {
            customerMap[customerName].goods.push({ name: item.name || '商品', quantity: item.quantity || 1 });
          }
        });
      });
      if (Object.keys(customerMap).length === 0) {
        return {
          code: 0,
          message: 'ok',
          data: {
            role, intent,
            answerDraft: '目前没有未取货的订单。',
            contextSummary: '暂无未取货订单。',
            suggestions: ['超过3天未取货有哪些', '本周营业额'],
            modelPayload: null,
            actionLog: '',
            forceUseDraft: true
          }
        };
      }
      let answerDraft = '以下买家有货品还没有取，详情如下\n\n';
      let contextSummary = '未取货订单（数据库回退）：\n';
      Object.values(customerMap).forEach((customer) => {
        answerDraft += `${customer.name}  ${customer.phone} 取货码:${customer.pickupCode}\n`;
        customer.goods.forEach((item) => {
          answerDraft += `${item.name}   ×${item.quantity}\n`;
          contextSummary += `- ${customer.name} ${item.name} ×${item.quantity}\n`;
        });
        answerDraft += '\n';
      });
      return {
        code: 0,
        message: 'ok',
        data: {
          role, intent, answerDraft, contextSummary,
          suggestions: ['超过3天未取货有哪些', '本周营业额'],
          modelPayload: null,
          actionLog: '',
          forceUseDraft: true
        }
      };
    }

    // 商家特殊意图：查询特定商品的未取货买家
    if (role === 'merchant' && intent === 'merchant_goods_buyers') {
      try {
        // 从消息中提取商品名称
        const targetGoods = matchGoods(message, contextData.goodsList);
        if (!targetGoods) {
          return {
            code: 0,
            message: 'ok',
            data: {
              role,
              intent,
              answerDraft: '请明确您要查询的商品名称。',
              contextSummary: '未识别到商品名称。',
              suggestions: ['未取货订单有哪些', '本周营业额'],
              modelPayload: null,
              actionLog: '',
              forceUseDraft: true
            }
          };
        }

        // 调用 getMerchantOrderGoods 云函数获取商品详情
        const goodsDetailRes = await cloud.callFunction({
          name: 'getMerchantOrderGoods',
          data: {
            type: 'detail',
            docId: targetGoods._id,
            goodsId: targetGoods.goodsId
          }
        });

        if (goodsDetailRes.result && goodsDetailRes.result.code === 0) {
          const goodsDetail = goodsDetailRes.result.data || {};
          const customers = goodsDetail.customers || [];

          // 筛选出未取货的买家
          const pendingCustomers = customers.filter(customer =>
            customer.status === '待取货'
          );

          let answerDraft = '';
          let contextSummary = '';

          if (pendingCustomers.length === 0) {
            answerDraft = `${targetGoods.name} 没有待取货的买家。所有买家都已取货完成。`;
            contextSummary = `${targetGoods.name}：无待取货买家`;
          } else {
            // 按照要求的格式构建回复
            answerDraft = pendingCustomers.map((customer) => `${customer.customerName} ${customer.phone || '暂无电话'} 还有${customer.totalQty}件${targetGoods.name}未取`).join('；');
            contextSummary = pendingCustomers.map((customer) => `${customer.customerName}（${customer.phone || '暂无电话'}）：${customer.totalQty}件`).join('；');
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
              modelPayload: null,
              actionLog: '',
              forceUseDraft: true
            }
          };
        }
      } catch (error) {
        console.error('获取商品买家列表失败:', error);

        // 使用本地订单数据进行处理作为备份方案
        const targetGoods = matchGoods(message, contextData.goodsList);
        if (!targetGoods) {
          return {
            code: 0,
            message: 'ok',
            data: {
              role,
              intent,
              answerDraft: '请明确您要查询的商品名称。',
              contextSummary: '未识别到商品名称。',
              suggestions: ['未取货订单有哪些', '本周营业额'],
              modelPayload: null,
              actionLog: '',
              forceUseDraft: true
            }
          };
        }

        const customerMap = {};

        contextData.orders.forEach((order) => {
          (Array.isArray(order.goods) ? order.goods : []).forEach((item) => {
            if (String(item.goodsId || '') === String(targetGoods.goodsId || targetGoods._id) && item.pickupStatus === '待取货') {
              const customerName = (order.customerInfo && order.customerInfo.name) || '未知顾客';
              const customerPhone = (order.customerInfo && order.customerInfo.phone) || '暂无电话';
              const quantity = Number(item.quantity || 0);

              if (!customerMap[customerName]) {
                customerMap[customerName] = {
                  name: customerName,
                  phone: customerPhone,
                  quantity: 0
                };
              }
              customerMap[customerName].quantity += quantity;
            }
          });
        });

        const customers = Object.values(customerMap);
        let answerDraft = '';
        let contextSummary = '';

        if (customers.length === 0) {
          answerDraft = `目前没有关于"${targetGoods.name}"的未取货订单记录。`;
          contextSummary = `暂无${targetGoods.name}的未取货订单。`;
        } else {
          // 按照要求的格式构建回复
          answerDraft = customers.map((customer) => `${customer.name} ${customer.phone} 还有${customer.quantity}件${targetGoods.name}未取`).join('；');
          contextSummary = customers.map((customer) => `${customer.name}（${customer.phone}）：${customer.quantity}件`).join('；');
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
            modelPayload: null,
            actionLog: '',
            forceUseDraft: true
          }
        };
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

    // 构建回复结果
    const result = role === 'merchant'
      ? buildMerchantResult(intent, message, contextData)
      : buildCustomerResult(intent, message, contextData);

    // 执行商家操作（如果有）
    let actionLog = '';
    if (role === 'merchant' && result.action) {
      actionLog = await executeMerchantAction(result.action);
    }

    // 创建大模型消息
    const bypassModel = shouldBypassModel(role, intent);
    const modelPayload = bypassModel ? null : createModelMessages({
      role,
      userName: contextData.user.nickName,
      message,
      history,
      answerDraft: result.answerDraft,
      contextSummary: result.contextSummary,
      suggestions: result.suggestions,
      actionLog
    });

    // 记录操作日志
    await writeOperationLog({
      openid: OPENID,
      role,
      intent,
      scene: event.scene || role,
      message,
      action: result.action || null,
      actionLog
    });

    // 返回结果
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
        forceUseDraft: bypassModel,
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

/**
 * 检查是否为商家专属意图
 * @param {string} intent - 意图
 * @returns {boolean} - 是否为商家专属意图
 */
function isMerchantOnlyIntent(intent) {
  const merchantOnlyIntents = [
    'merchant_stock_goods',
    'merchant_special_goods',
    'merchant_preorder_overview',
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
 * @param {Object} event - 事件对象
 * @param {Object} context - 上下文对象
 * @returns {Object} - 响应结果
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
  const bypassModel = shouldBypassModel(contextData.role, validatedIntent);
  const modelPayload = bypassModel ? null : createModelMessages({
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
      actionLog,
      forceUseDraft: bypassModel
    }
  };
}
