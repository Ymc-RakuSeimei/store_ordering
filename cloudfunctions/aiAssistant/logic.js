const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value.$date) {
    const date = new Date(value.$date);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = normalizeDate(value);
  if (!date) return '未知时间';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `￥${amount.toFixed(2)}`;
}

function sanitizeMessageHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && item.role && item.content)
    .slice(-8)
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content).slice(0, 400)
    }));
}

function extractFactsFromAnswer(answer) {
  const facts = {
    numbers: [],
    productNames: [],
    dates: [],
    money: []
  };

  const moneyPattern = /￥?(\d+(?:\.\d+)?)/g;
  let match;
  while ((match = moneyPattern.exec(answer)) !== null) {
    facts.numbers.push({ value: parseFloat(match[1]), type: 'money', raw: match[0] });
    facts.money.push({ value: parseFloat(match[1]), raw: match[0] });
  }

  const datePattern = /\d{1,2}[月日点时分]|\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/g;
  while ((match = datePattern.exec(answer)) !== null) {
    facts.dates.push(match[0]);
  }

  return facts;
}

function verifyDataConsistency(originalData, llmAnswer, intent) {
  const warnings = [];
  const originalFacts = extractDataFacts(originalData);
  const answerFacts = extractFactsFromAnswer(llmAnswer);

  if (originalFacts.totalCount === 0 && answerFacts.numbers.length > 0) {
    const hasSignificantNumber = answerFacts.numbers.some(n => n.value > 10 || n.type === 'money');
    if (hasSignificantNumber) {
      warnings.push('回答中包含数据但原始数据为空');
    }
  }

  if (originalFacts.maxMoney !== undefined && answerFacts.maxMoney !== undefined) {
    if (answerFacts.maxMoney > originalFacts.maxMoney * 1.5) {
      warnings.push('回答中的金额超出原始数据范围');
    }
  }

  return warnings;
}

function extractDataFacts(data) {
  const facts = { totalCount: 0, maxMoney: undefined, items: [] };

  if (!data) return facts;

  if (Array.isArray(data)) {
    facts.totalCount = data.length;
    data.forEach(item => {
      if (item.price) {
        const price = Number(item.price);
        if (!facts.maxMoney || price > facts.maxMoney) {
          facts.maxMoney = price;
        }
      }
      if (item.name) {
        facts.items.push(String(item.name));
      }
    });
  } else if (typeof data === 'object') {
    if (data.revenue !== undefined) {
      facts.maxMoney = Number(data.revenue);
    }
    if (data.profit !== undefined) {
      facts.maxMoney = Number(data.profit);
    }
    if (data.answerDraft) {
      const moneyPattern = /(\d+(?:\.\d+)?)/g;
      const prices = [];
      let match;
      while ((match = moneyPattern.exec(data.answerDraft)) !== null) {
        const val = parseFloat(match[1]);
        if (val > 0) prices.push(val);
      }
      if (prices.length > 0) {
        facts.maxMoney = Math.max(...prices);
      }
    }
  }

  return facts;
}

function extractAnswerFacts(answer) {
  const facts = { numbers: [], maxMoney: 0 };

  const moneyPattern = /￥?(\d+(?:\.\d{1,2})?)/g;
  let match;
  while ((match = moneyPattern.exec(answer)) !== null) {
    const val = parseFloat(match[1]);
    if (val > facts.maxMoney) {
      facts.maxMoney = val;
    }
    facts.numbers.push({ value: val, raw: match[0] });
  }

  return facts;
}

function detectDataFabrication(originalData, llmAnswer) {
  if (!originalData || !llmAnswer) return { isValid: true, warnings: [] };

  const warnings = [];
  const dataFacts = extractDataFacts(originalData);
  const answerFacts = extractAnswerFacts(llmAnswer);

  if (dataFacts.totalCount === 0 && llmAnswer.length > 20) {
    if (/(共|总计|合计|一共|总共有)/.test(llmAnswer) && /\d+[个件名]/.test(llmAnswer)) {
      warnings.push('原始数据为空，但回答中似乎包含统计数据');
    }
  }

  if (dataFacts.maxMoney > 0) {
    if (answerFacts.maxMoney > dataFacts.maxMoney * 2) {
      warnings.push('回答中的金额显著超出原始数据范围');
    }
  }

  const sensitivePattern = /(其他用户|别的用户|其他订单|别的订单)/;
  if (sensitivePattern.test(llmAnswer) && typeof originalData === 'object') {
    if (originalData.role === 'customer') {
      warnings.push('回答可能涉及其他用户数据');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings
  };
}

function correctFabricatedAnswer(originalData, llmAnswer, intent) {
  const validation = detectDataFabrication(originalData, llmAnswer);

  if (validation.isValid) {
    return llmAnswer;
  }

  let corrected = llmAnswer;
  const originalFacts = extractDataFacts(originalData);

  if (originalFacts.totalCount === 0) {
    const fabricatedCount = llmAnswer.match(/(共|总计|合计|一共|总共有)\s*(\d+)/);
    if (fabricatedCount) {
      corrected = llmAnswer.replace(fabricatedCount[0], '暂无相关数据');
    }
  }

  if (originalFacts.maxMoney === 0) {
    const fabricatedMoney = llmAnswer.match(/￥?\d+\.?\d*/);
    if (fabricatedMoney && parseFloat(fabricatedMoney[0]) > 0) {
      corrected = corrected.replace(fabricatedMoney[0], '数据不足');
    }
  }

  console.warn('检测到大模型可能编造答案，已进行修正:', validation.warnings);

  return corrected;
}

function matchGoods(message, goodsList) {
  const text = normalizeText(message);
  const exactMatched = goodsList.filter((item) => {
    const name = normalizeText(item.name);
    const goodsId = normalizeText(item.goodsId || item._id);
    return (name && text.includes(name)) || (goodsId && text.includes(goodsId));
  });

  if (exactMatched.length) {
    return exactMatched;
  }

  return goodsList.filter((item) => {
    const tokens = normalizeText(item.name).split(/\s+/).filter(Boolean);
    return tokens.some((token) => token.length >= 2 && text.includes(token));
  });
}

function detectPeriod(message) {
  if (/本周|这周|周/.test(message)) return 'week';
  if (/今天|今日|当天|日/.test(message)) return 'day';
  return 'month';
}

function getRangeStart(period, now = new Date()) {
  if (period === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function extractPrice(message) {
  const match = String(message).match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function extractThreshold(message) {
  const match = String(message).match(/阈值[^0-9]*(\d+)|预警[^0-9]*(\d+)|低于[^0-9]*(\d+)/);
  if (!match) return null;
  return Number(match[1] || match[2] || match[3]);
}

function detectIntent(role, message) {
  const text = String(message || '');

  if (role === 'merchant') {
    // 1. 查询待取货商品统计（优先匹配，更具体）
    // 匹配问法："有哪些货物没有被取完"、"还有哪些货没取"、"待取货商品有哪些"
    if (/哪些.*货.*没取|哪些.*货.*被取|哪些.*货物.*没取完|待取货.*有哪些|还有哪些.*没取|没取完.*有哪些/.test(text)) return 'merchant_pending_pickup_goods';

    // 2. 查询特定商品的买家列表（需要包含商品名+谁没取货）
    // 匹配问法："xx还有谁没取货"、"xx谁还没取"
    if (/还有谁没取|谁还没取|谁没取货/.test(text)) return 'merchant_goods_buyers';

    if (/营业额|净利润|利润|销售额/.test(text)) return 'merchant_turnover';
    if (/接龙.*统计|预定量|参与人数/.test(text)) return 'merchant_preorder_stats';
    if (/批量.*阈值|批量.*预警|全部.*阈值|设为\d+/.test(text)) return 'merchant_batch_threshold';
    if (/低库存|库存预警|库存不足/.test(text)) return 'merchant_low_stock';
    if (/补货|补多少|补货建议/.test(text)) return 'merchant_restock';
    if (/未取货|未提货|超过3天/.test(text)) return 'merchant_unpicked';
    if (/售后|退款|换货|反馈/.test(text)) return 'merchant_after_sale';
    if (/修改.*价格|价格改|调价/.test(text)) return 'merchant_update_price';
    if (/上架|下架/.test(text)) return 'merchant_toggle_sale';
    if (/怎么|如何|在哪|教程|指引|帮助/.test(text)) return 'merchant_help';
  }

  // 买家专属意图 - 按照匹配优先级排序（更具体的意图优先）

  // 1. 我的订单查询（最具体，包含"我的"或"我有哪些"）
  // 支持多种问法："我有哪些货没取"、"我的订单"、"我买了什么"等
  if (/我有哪些.*没取|我有哪些.*待取|我有哪些.*未取|我.*货.*没取|我.*没取.*货|我.*货.*待取/.test(text)) return 'customer_my_orders';
  if (/我.*订单|我的订单|我.*买.*什么|我.*订.*什么/.test(text)) return 'customer_my_orders';

  // 2. 我的接龙/预定查询（查询用户自己的接龙记录）
  // 注意：需要排除查询所有接龙活动的问法，如"现在有哪些接龙活动"
  if ((/我.*接龙|我.*预定/.test(text) && !/现在|当前|有哪些|列表/.test(text)) || /我买了多少/.test(text)) return 'customer_my_preorder';

  // 3. 取货码查询
  if (/取货码|提货码/.test(text)) return 'customer_pickup_code';

  // 4. 商品信息查询
  if (/价格|多少钱|售价|规格/.test(text)) return 'customer_goods_info';

  // 5. 库存查询
  if (/库存|现货|还有吗|能订|预售|可订/.test(text)) return 'customer_stock';

  // 6. 接龙活动列表（查询所有正在进行的接龙活动）
  // 匹配问法："现在有哪些接龙活动"、"当前有哪些接龙"、"接龙活动列表"等
  if (/接龙|预定活动|预售活动/.test(text) && /现在|当前|有哪些|列表|截止|进行/.test(text)) return 'customer_preorder_list';

  // 7. 接龙统计
  if (/接龙.*统计|预定量|参与人数/.test(text)) return 'customer_preorder_stats';

  // 8. 订单状态查询（通用，放在后面避免覆盖更具体的意图）
  if (/订单|到货|可取货|取货时间/.test(text)) return 'customer_order_status';

  // 9. 优惠活动
  if (/特价|临期|秒杀|优惠/.test(text)) return 'customer_promotions';
  return role === 'merchant' ? 'merchant_help' : 'customer_goods_info';
}

function summarizeGoods(item) {
  const stock = Number(item.stock || 0);
  const totalBooked = Number(item.totalBooked || 0);
  const parts = [
    `${item.name || '商品'}`,
    `售价${formatCurrency(item.price)}`,
    item.specs ? `规格${item.specs}` : '',
    item.type === 'preorder' ? `预定量${totalBooked}` : `库存${stock}`
  ].filter(Boolean);
  return `- ${parts.join('，')}`;
}

function summarizeOrders(orders) {
  if (!orders.length) return '暂无匹配订单。';
  return orders.slice(0, 5).map((order) => {
    const itemText = (Array.isArray(order.goods) ? order.goods : [])
      .map((item) => `${item.name}x${item.quantity}`)
      .join('、');
    return `- 订单${order.orderNo || order._id}：状态${order.status || '未知'}，商品${itemText || '无'}，下单于${formatDateTime(order.paytime || order.createdAt)}。`;
  }).join('\n');
}

function buildHelpAnswer(role) {
  if (role === 'merchant') {
    return {
      answerDraft: '你可以直接问我“本周营业额”“哪些商品低库存”“把瑞幸咖啡价格改成16元”“把全部商品库存预警阈值设为8”“未取货订单有哪些”“怎么发起接龙”“数据中心在哪”。',
      contextSummary: '商家帮助场景，优先返回功能入口、操作步骤和可直接执行的指令示例。',
      suggestions: ['本周营业额', '哪些商品低库存', '怎么发起接龙']
    };
  } else {
    return {
      answerDraft: '你可以直接问我“瑞幸咖啡多少钱”“现在有哪些接龙活动”“我的订单到货了吗”“我的取货码是多少”“今天有什么特价商品”。',
      contextSummary: '买家帮助场景，优先返回商品、订单、接龙和优惠查询示例。',
      suggestions: ['今天有什么特价商品', '我的取货码是多少', '现在有哪些接龙活动']
    };
  }
}

function buildCustomerResult(intent, message, context) {
  const { goodsList, orders, user } = context;
  const matchedGoods = matchGoods(message, goodsList);
  const now = new Date();

  // 获取当前用户的openid（从user对象或context中获取）
  const userOpenid = user?.openid || context?.openid || '';

  // 筛选进行中的接龙活动 - 使用与前端一致的逻辑
  const preorderGoods = goodsList.filter((item) => {
    // 必须是接龙商品
    if (item.type !== 'preorder') return false;
    // 排除已关闭的接龙
    if (item.preorderState === 'closed') return false;
    // 检查定时关闭
    if (item.closeType === 'timed' && item.closeAt) {
      const closeAt = normalizeDate(item.closeAt);
      if (closeAt && closeAt <= now) return false;
    }
    // 检查是否已截止（使用closedAt字段）
    if (item.closedAt) {
      const closedAt = new Date(item.closedAt).getTime();
      if (!Number.isNaN(closedAt) && closedAt <= now) return false;
    }
    return true;
  });

  const specialGoods = goodsList.filter((item) => item.type === 'special');

  // 筛选当前用户的订单 - 使用userOpenid确保正确匹配
  const userOrders = orders.filter((item) => {
    // 优先使用传入的userOpenid进行匹配
    if (userOpenid) {
      return item.openid === userOpenid;
    }
    // 如果没有userOpenid，则不过滤（返回所有订单，但这种情况不应该发生）
    return true;
  });

  if (intent === 'customer_goods_info') {
    if (!matchedGoods.length) {
      return {
        answerDraft: '我还没定位到你想问的商品。你可以直接说商品名，例如“瑞幸咖啡多少钱”或“枣园小炒有什么规格”。',
        contextSummary: `当前可查商品：\n${goodsList.slice(0, 8).map(summarizeGoods).join('\n')}`,
        suggestions: goodsList.slice(0, 3).map((item) => `${item.name}多少钱`)
      };
    }

    return {
      answerDraft: matchedGoods.slice(0, 3).map((item) => `${item.name}售价${formatCurrency(item.price)}，规格为${item.specs || '默认规格'}。`).join('\n'),
      contextSummary: matchedGoods.slice(0, 5).map(summarizeGoods).join('\n'),
      suggestions: matchedGoods.slice(0, 3).map((item) => `${item.name}还有库存吗`)
    };
  }

  if (intent === 'customer_stock') {
    if (!matchedGoods.length) {
      return {
        answerDraft: '我没有识别到具体商品。你可以问“瑞幸咖啡还有吗”或“枣园小炒库存够吗”。',
        contextSummary: `库存样本：\n${goodsList.slice(0, 8).map(summarizeGoods).join('\n')}`,
        suggestions: goodsList.slice(0, 3).map((item) => `${item.name}还有吗`)
      };
    }

    return {
      answerDraft: matchedGoods.slice(0, 3).map((item) => {
        if (item.type === 'preorder') {
          const statusText = item.preorderState === 'closed' ? '当前接龙已截止' : '当前可以预订';
          return `${item.name}${statusText}，已预定${Number(item.totalBooked || 0)}份，预计到货时间${item.arrivalDate || '待商家通知'}。`;
        }
        return `${item.name}当前库存约${Number(item.stock || 0)}件，${Number(item.stock || 0) > 0 ? '现货可下单。' : '暂时缺货。'}`;
      }).join('\n'),
      contextSummary: matchedGoods.slice(0, 5).map(summarizeGoods).join('\n'),
      suggestions: ['现在有哪些接龙活动', '今天有什么特价商品']
    };
  }

  if (intent === 'customer_preorder_list') {
    return {
      answerDraft: preorderGoods.length
        ? preorderGoods.slice(0, 5).map((item) => `${item.name}正在接龙中，已预定${Number(item.totalBooked || 0)}份，截止/到货信息：${item.closeAt || item.arrivalDate || '待商家通知'}。`).join('\n')
        : '当前没有进行中的接龙活动。',
      contextSummary: preorderGoods.length ? preorderGoods.map(summarizeGoods).join('\n') : '暂无进行中的接龙商品。',
      suggestions: preorderGoods.slice(0, 3).map((item) => `${item.name}接龙统计`)
    };
  }

  if (intent === 'customer_preorder_stats') {
    // 只统计正在进行中的接龙活动
    const now = new Date();
    const targets = matchedGoods.length
      ? matchedGoods.filter(item => {
        if (item.type !== 'preorder') return false;
        if (item.preorderState === 'closed') return false;
        if (item.closeType === 'timed' && item.closeAt) {
          const closeAt = normalizeDate(item.closeAt);
          if (closeAt && closeAt <= now) return false;
        }
        return true;
      })
      : preorderGoods;
    const stats = targets.slice(0, 3).map((item) => {
      const relatedOrders = orders.filter((order) => (Array.isArray(order.goods) ? order.goods : []).some((goods) => String(goods.goodsId || '') === String(item.goodsId || item._id)));
      const participants = new Set(relatedOrders.map((order) => order.openid)).size;
      return `${item.name}当前总预定量${Number(item.totalBooked || 0)}，参与人数${participants}。`;
    });
    return {
      answerDraft: stats.length ? stats.join('\n') : '我暂时没找到对应接龙统计。',
      contextSummary: stats.join('\n') || '暂无接龙统计。',
      suggestions: ['我的接龙记录', '我的订单到货了吗']
    };
  }

  if (intent === 'customer_my_preorder') {
    const records = [];
    userOrders.forEach((order) => {
      (Array.isArray(order.goods) ? order.goods : []).forEach((item) => {
        const goodsDoc = goodsList.find((goods) => String(goods.goodsId || goods._id) === String(item.goodsId || ''));
        if (goodsDoc && goodsDoc.type === 'preorder') {
          records.push({
            name: item.name,
            quantity: Number(item.quantity || 0),
            specs: goodsDoc.specs || ''
          });
        }
      });
    });

    return {
      answerDraft: records.length
        ? records.map((item) => `${item.name}，你已预定${item.quantity}份，规格${item.specs || '默认规格'}。`).join('\n')
        : '你当前还没有查到接龙预定记录。',
      contextSummary: records.length
        ? records.map((item) => `- ${item.name} x ${item.quantity}，规格${item.specs || '默认规格'}`).join('\n')
        : '该用户暂无接龙记录。',
      suggestions: ['我的订单到货了吗', '我的取货码是多少']
    };
  }

  // 处理"我的订单"查询 - 只显示当前用户的订单
  if (intent === 'customer_my_orders') {
    // 收集所有未取货的商品（与前端逻辑保持一致）
    // 前端逻辑：goods.pickupStatus !== '已取货' && goods.pickupStatus !== '已完成'
    const pendingGoods = [];      // 待取货（已到货）
    const notArrivedGoods = [];   // 未到货

    userOrders.forEach(order => {
      (Array.isArray(order.goods) ? order.goods : []).forEach(item => {
        const pickupStatus = item.pickupStatus || '未到货';

        // 只处理未取货的商品（与前端waiting组件逻辑一致）
        if (pickupStatus !== '已取货' && pickupStatus !== '已完成') {
          const goodsItem = {
            ...item,
            orderNo: order.orderNo || order._id,
            orderTime: order.paytime || order.createdAt,
            pickupStatus: pickupStatus
          };

          // 根据状态分类
          if (pickupStatus === '待取货') {
            pendingGoods.push(goodsItem);
          } else {
            // 其他状态（未到货、已到货等）都归为未到货
            notArrivedGoods.push(goodsItem);
          }
        }
      });
    });

    if (pendingGoods.length === 0 && notArrivedGoods.length === 0) {
      return {
        answerDraft: '你当前没有待取货或未到货的商品。所有商品都已取货或暂无订单记录。',
        contextSummary: `用户${user.nickName}的订单：无待取货或未到货商品`,
        suggestions: ['查看全部订单', '今天有什么特价商品']
      };
    }

    let answerDraft = '';
    let contextSummary = `用户${user.nickName}的商品状态：`;

    if (pendingGoods.length > 0) {
      answerDraft += `你有 ${pendingGoods.length} 个商品待取货：\n`;
      contextSummary += `\n待取货商品：`;
      pendingGoods.forEach((item, index) => {
        answerDraft += `${index + 1}. ${item.name} x${item.quantity || 1}，订单号：${item.orderNo}\n`;
        contextSummary += `\n- ${item.name} x${item.quantity || 1}（订单${item.orderNo}）`;
      });
    }

    if (notArrivedGoods.length > 0) {
      if (answerDraft) answerDraft += '\n';
      answerDraft += `你有 ${notArrivedGoods.length} 个商品未到货：\n`;
      contextSummary += `\n未到货商品：`;
      notArrivedGoods.forEach((item, index) => {
        answerDraft += `${index + 1}. ${item.name} x${item.quantity || 1}，订单号：${item.orderNo}\n`;
        contextSummary += `\n- ${item.name} x${item.quantity || 1}（订单${item.orderNo}）`;
      });
    }

    return {
      answerDraft,
      contextSummary,
      suggestions: ['我的取货码是多少', '查看全部订单']
    };
  }

  if (intent === 'customer_order_status' || intent === 'customer_pickup_code') {
    const latestOrders = userOrders.slice(0, 5);

    if (intent === 'customer_pickup_code') {
      const pickupCode = user.pickupCode || '暂无';
      return {
        answerDraft: `你的取货码是 ${pickupCode}。`,
        contextSummary: `用户取货码：${pickupCode}`,
        suggestions: ['今天有什么特价商品', '我的订单状态']
      };
    }

    return {
      answerDraft: latestOrders.length
        ? latestOrders.map((order) => {
          const itemText = (Array.isArray(order.goods) ? order.goods : []).map((item) => `${item.name}${item.pickupStatus ? `(${item.pickupStatus})` : ''}`).join('、');
          return `订单${order.orderNo || ''}当前状态${order.status || '未知'}，商品：${itemText || '无'}。`;
        }).join('\n')
        : '你当前还没有查到订单记录。',
      contextSummary: summarizeOrders(latestOrders),
      suggestions: ['我的取货码是多少', '今天有什么特价商品']
    };
  }

  if (intent === 'customer_promotions') {
    // 优先使用 isNew=true 的商品作为特价商品
    const newGoods = goodsList.filter((item) => item.isNew === true);
    // 如果没有 isNew 商品，使用 type=special 的商品
    const promotionGoods = newGoods.length > 0 ? newGoods : specialGoods;

    return {
      answerDraft: promotionGoods.length
        ? promotionGoods.slice(0, 5).map((item) => `${item.name}当前特价${formatCurrency(item.price)}，规格${item.specs || '默认规格'}，库存${Number(item.stock || 0)}。`).join('\n')
        : '当前没有查到特价或秒杀商品。',
      contextSummary: promotionGoods.length ? promotionGoods.map(summarizeGoods).join('\n') : '暂无特价商品。',
      suggestions: promotionGoods.slice(0, 3).map((item) => `${item.name}多少钱`)
    };
  }

  return buildHelpAnswer('customer');
}

function computeMerchantTurnover(goodsList, orders, period) {
  const rangeStart = getRangeStart(period);
  let revenue = 0;
  let profit = 0;

  orders.forEach((order) => {
    const createdAt = normalizeDate(order.paytime || order.createdAt);
    if (!createdAt || createdAt < rangeStart) return;

    (Array.isArray(order.goods) ? order.goods : []).forEach((item) => {
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const goodsDoc = goodsList.find((goods) => String(goods.goodsId || goods._id) === String(item.goodsId || ''));
      const cost = Number(goodsDoc && goodsDoc.cost ? goodsDoc.cost : 0);
      revenue += price * quantity;
      profit += (price - cost) * quantity;
    });
  });

  return {
    revenue,
    profit
  };
}

function buildMerchantResult(intent, message, context) {
  const { goodsList, orders, feedbacks } = context;
  const matchedGoods = matchGoods(message, goodsList);

  if (intent === 'merchant_turnover') {
    const period = detectPeriod(message);
    const stats = computeMerchantTurnover(goodsList, orders, period);
    const periodLabelMap = { day: '今日', week: '本周', month: '本月' };
    return {
      answerDraft: `${periodLabelMap[period] || '本月'}总营业额${formatCurrency(stats.revenue)}，预估净利润${formatCurrency(stats.profit)}。`,
      contextSummary: `统计周期：${period}。营业额${formatCurrency(stats.revenue)}，净利润${formatCurrency(stats.profit)}。`,
      suggestions: ['哪些商品低库存', '当前接龙统计']
    };
  }

  if (intent === 'merchant_preorder_stats') {
    const preorderGoods = goodsList.filter((item) => item.type === 'preorder');
    const totalUsers = new Set(orders.map((item) => item.openid)).size || 1;
    const targets = matchedGoods.length ? matchedGoods : preorderGoods;
    const lines = targets.slice(0, 5).map((item) => {
      const relatedOrders = orders.filter((order) => (Array.isArray(order.goods) ? order.goods : []).some((goods) => String(goods.goodsId || '') === String(item.goodsId || item._id)));
      const participants = new Set(relatedOrders.map((order) => order.openid)).size;
      const conversion = ((participants / totalUsers) * 100).toFixed(1);
      return `${item.name}：预定量${Number(item.totalBooked || 0)}，参与人数${participants}，转化率${conversion}%。`;
    });
    return {
      answerDraft: lines.length ? lines.join('\n') : '当前没有可统计的接龙商品。',
      contextSummary: lines.join('\n') || '暂无接龙统计。',
      suggestions: ['本周营业额', '哪些商品低库存']
    };
  }

  if (intent === 'merchant_low_stock') {
    const lowStock = goodsList
      .filter((item) => Number(item.stock || 0) <= Number(item.inventoryAlertThreshold || 10))
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    return {
      answerDraft: lowStock.length
        ? lowStock.slice(0, 10).map((item) => `${item.name}库存${Number(item.stock || 0)}，预警阈值${Number(item.inventoryAlertThreshold || 10)}。`).join('\n')
        : '目前没有低于预警阈值的商品。',
      contextSummary: lowStock.length ? lowStock.map(summarizeGoods).join('\n') : '暂无低库存商品。',
      suggestions: ['给我补货建议', '把全部商品库存预警阈值设为8']
    };
  }

  if (intent === 'merchant_restock') {
    const rangeStart = Date.now() - 7 * DAY_MS;
    const lines = goodsList.slice(0, 10).map((item) => {
      let soldQty = 0;
      orders.forEach((order) => {
        const createdAt = normalizeDate(order.paytime || order.createdAt);
        if (!createdAt || createdAt.getTime() < rangeStart) return;
        (Array.isArray(order.goods) ? order.goods : []).forEach((goods) => {
          if (String(goods.goodsId || '') === String(item.goodsId || item._id)) {
            soldQty += Number(goods.quantity || 0);
          }
        });
      });
      const suggested = Math.max(Math.ceil(soldQty * 1.5 - Number(item.stock || 0)), 0);
      return `${item.name}近7天销量${soldQty}，当前库存${Number(item.stock || 0)}，建议补货${suggested}。`;
    });
    return {
      answerDraft: lines.join('\n'),
      contextSummary: lines.join('\n'),
      suggestions: ['哪些商品低库存', '未取货订单有哪些']
    };
  }

  if (intent === 'merchant_unpicked') {
    const deadline = Date.now() - 3 * DAY_MS;
    const results = orders.filter((order) => {
      const createdAt = normalizeDate(order.paytime || order.createdAt);
      return createdAt && createdAt.getTime() <= deadline && /待取货/.test(String(order.status || ''));
    });

    if (results.length === 0) {
      return {
        answerDraft: '目前没有超过3天未取货的订单。',
        contextSummary: '暂无超3天未取货订单。',
        suggestions: ['新的售后申请有哪些', '本周营业额']
      };
    }

    // 按顾客分组，显示具体商品
    const customerMap = {};
    results.forEach((order) => {
      const customerName = (order.customerInfo && order.customerInfo.name) || '未知顾客';
      const customerPhone = (order.customerInfo && order.customerInfo.phone) || '暂无电话';
      const pickupCode = order.pickupCode || '暂无';
      const orderTime = formatDateTime(order.paytime || order.createdAt);

      if (!customerMap[customerName]) {
        customerMap[customerName] = {
          name: customerName,
          phone: customerPhone,
          pickupCode,
          orders: []
        };
      }

      const goodsList = (Array.isArray(order.goods) ? order.goods : [])
        .filter((item) => item.pickupStatus === '待取货')
        .map((item) => `${item.name || '商品'} x${item.quantity || 1}`)
        .join('、');

      if (goodsList) {
        customerMap[customerName].orders.push({
          goods: goodsList,
          time: orderTime,
          code: pickupCode
        });
      }
    });

    // 构建回复
    let answerDraft = '目前有以下超过3天未取货的订单：\n\n';
    Object.values(customerMap).forEach((customer, index) => {
      answerDraft += `${index + 1}. ${customer.name} ${customer.phone ? `（${customer.phone}）` : ''}\n`;
      customer.orders.forEach((order, orderIndex) => {
        answerDraft += `   ${orderIndex + 1}. ${order.goods}\n`;
        answerDraft += `      下单时间：${order.time}，取货码：${order.code}\n`;
      });
      answerDraft += '\n';
    });

    return {
      answerDraft,
      contextSummary: answerDraft,
      suggestions: ['新的售后申请有哪些', '本周营业额']
    };
  }



  if (intent === 'merchant_after_sale') {
    const pending = feedbacks.filter((item) => /待处理/.test(String(item.status || '待处理')));
    return {
      answerDraft: pending.length
        ? pending.slice(0, 10).map((item) => `${item.type || '售后'}：${item.goodsName || item.orderNo || item._id}，原因${item.reason || item.content || '未填写'}，提交时间${formatDateTime(item.createdAt)}。`).join('\n')
        : '目前没有新的退款、换货或售后申请。',
      contextSummary: pending.length
        ? pending.slice(0, 10).map((item) => `- ${item.type || '售后'} ${item.goodsName || item.orderNo || item._id}`).join('\n')
        : '暂无新售后申请。',
      suggestions: ['未取货订单有哪些', '哪些商品低库存']
    };
  }

  if (intent === 'merchant_update_price') {
    const nextPrice = extractPrice(message);
    const target = matchedGoods[0];
    if (!target || nextPrice === null) {
      return {
        answerDraft: '要改价的话，请直接说“把商品名价格改成16.8元”。',
        contextSummary: '未识别到明确商品或价格。',
        suggestions: goodsList.slice(0, 3).map((item) => `把${item.name}价格改成${Number(item.price || 0)}`)
      };
    }

    return {
      action: {
        type: 'update_price',
        goodsId: target._id,
        name: target.name,
        sellPrice: nextPrice,
        costPrice: Number(target.cost || 0),
        stock: Number(target.stock || 0),
        description: target.description || '',
        img: Array.isArray(target.images) && target.images[0] ? target.images[0] : ''
      },
      answerDraft: `已识别到调价意图：准备把${target.name}价格改为${formatCurrency(nextPrice)}。`,
      contextSummary: `待执行操作：修改${target.name}价格为${formatCurrency(nextPrice)}。`,
      suggestions: ['哪些商品低库存', '本周营业额']
    };
  }

  if (intent === 'merchant_toggle_sale') {
    const target = matchedGoods[0];
    if (!target) {
      return {
        answerDraft: '要上架或下架商品，请直接说“上架商品名”或“下架商品名”。',
        contextSummary: '未识别到明确商品。',
        suggestions: goodsList.slice(0, 3).map((item) => `下架${item.name}`)
      };
    }
    const onStatus = /下架/.test(message) ? 'off' : 'on';
    return {
      action: {
        type: 'toggle_sale',
        goodsId: target._id,
        name: target.name,
        onStatus
      },
      answerDraft: `已识别到${onStatus === 'on' ? '上架' : '下架'}意图：准备更新${target.name}的销售状态。`,
      contextSummary: `待执行操作：${onStatus === 'on' ? '上架' : '下架'} ${target.name}。`,
      suggestions: ['本周营业额', '哪些商品低库存']
    };
  }

  if (intent === 'merchant_batch_threshold') {
    const threshold = extractThreshold(message);
    if (threshold === null) {
      return {
        answerDraft: '批量设置阈值时，请直接说“把全部商品库存预警阈值设为8”。',
        contextSummary: '未识别到明确阈值。',
        suggestions: ['把全部商品库存预警阈值设为8']
      };
    }

    return {
      action: {
        type: 'batch_inventory_threshold',
        threshold
      },
      answerDraft: `已识别到批量操作：准备把全部商品库存预警阈值设为${threshold}。`,
      contextSummary: `待执行操作：批量设置库存预警阈值为${threshold}。`,
      suggestions: ['哪些商品低库存', '给我补货建议']
    };
  }

  return buildHelpAnswer('merchant');
}

function createModelMessages(params) {
  const { role, userName, message, history, answerDraft, contextSummary, suggestions, actionLog } = params;

  const roleDesc = role === 'merchant'
    ? '你是MC_store商家助手，可查营业额/利润、库存、订单、售后；可执行改价、上下架、设置预警操作。'
    : '你是MC_store买家助手，只能查商品、订单、取货码、接龙、优惠，只能看自己的数据。';

  const systemContent = [
    roleDesc,
    '回答简洁自然口语化，不要编造，不要暴露技术细节。',
    contextSummary ? `背景数据：\n${contextSummary}` : '',
    answerDraft ? `可参考的信息：\n${answerDraft}` : '',
    suggestions?.length ? `可顺带推荐：${suggestions.join('、')}` : ''
  ].filter(Boolean).join('\n');

  const conversation = sanitizeMessageHistory(history);

  const userContent = [
    userName ? `用户：${userName}` : '',
    actionLog ? `刚执行的操作结果：${actionLog}` : '',
    `问题：${message}`
  ].filter(Boolean).join('\n');

  return {
    messages: [
      { role: 'system', content: systemContent },
      ...conversation,
      { role: 'user', content: userContent }
    ]
  };
}

// 意图定义和说明 - 用于大模型理解
const INTENT_DEFINITIONS = {
  // 买家意图
  customer_goods_info: '用户想查询商品价格、规格等信息。例如："瑞幸咖啡多少钱"、"枣园小炒有什么规格"',
  customer_stock: '用户想查询商品库存情况。例如："瑞幸咖啡还有吗"、"枣园小炒库存够吗"',
  customer_preorder_list: '用户想查看当前有哪些接龙/预定活动。例如："现在有哪些接龙活动"、"当前有哪些预定"',
  customer_preorder_stats: '用户想查看接龙活动的统计数据。例如："接龙统计"、"预定量多少"',
  customer_my_preorder: '用户想查看自己参与的接龙/预定记录。例如："我参与的接龙"、"我买了多少"',
  customer_my_orders: '用户想查看自己的订单，特别是待取货/未到货的商品。例如："我有哪些货没取"、"我的订单"、"我买了什么"',
  customer_order_status: '用户想查询订单状态。例如："我的订单到货了吗"、"订单状态"',
  customer_pickup_code: '用户想查询取货码。例如："我的取货码是多少"、"提货码"',
  customer_promotions: '用户想查看优惠活动/特价商品。例如："今天有什么特价商品"、"有什么优惠"',

  // 商家意图
  merchant_turnover: '商家想查询营业额/利润。例如："本周营业额"、"利润多少"',
  merchant_preorder_stats: '商家想查看接龙统计数据。例如："接龙统计"、"转化率多少"',
  merchant_low_stock: '商家想查看低库存商品。例如："哪些商品低库存"、"库存预警"',
  merchant_restock: '商家想获取补货建议。例如："给我补货建议"、"补多少货"',
  merchant_unpicked: '商家想查看未取货订单。例如："未取货订单有哪些"、"超过3天未取货"',
  merchant_after_sale: '商家想查看售后/反馈。例如："售后申请"、"退款换货"',
  merchant_update_price: '商家想修改商品价格。例如："把瑞幸咖啡价格改成16元"',
  merchant_toggle_sale: '商家想上架/下架商品。例如："上架商品"、"下架商品"',
  merchant_batch_threshold: '商家想批量设置库存预警阈值。例如："把全部商品库存预警阈值设为8"',
  merchant_pending_pickup_goods: '商家想查看所有待取货商品的统计。例如："有哪些货物没有被取完"、"还有哪些货没取"',
  merchant_goods_buyers: '商家想查看特定商品的待取货买家列表。例如："李宁战戟8000还有谁没取货"、"xx商品谁还没取"',
  merchant_help: '商家需要帮助/教程。例如："怎么发起接龙"、"教程"'
};

/**
 * 使用大模型理解用户意图
 * 当规则匹配不确定时，让大模型来判断最合适的意图
 */
function createIntentUnderstandingMessages(role, message, history) {
  const intentDescriptions = Object.entries(INTENT_DEFINITIONS)
    .filter(([key]) => key.startsWith(role))
    .map(([key, desc]) => `- ${key}: ${desc}`)
    .join('\n');

  const systemContent = `你是意图识别助手。请分析用户的问题，判断最符合的意图。

可用意图列表：
${intentDescriptions}

请只返回意图名称，不要返回其他内容。如果无法确定，返回"unknown"。`;

  const conversation = sanitizeMessageHistory(history);

  return {
    messages: [
      { role: 'system', content: systemContent },
      ...conversation,
      { role: 'user', content: `用户问题：${message}\n\n请判断意图：` }
    ]
  };
}

module.exports = {
  createModelMessages,
  createIntentUnderstandingMessages,
  detectIntent,
  buildCustomerResult,
  buildMerchantResult,
  matchGoods,
  INTENT_DEFINITIONS,
  detectDataFabrication,
  correctFabricatedAnswer,
  verifyDataConsistency
};
