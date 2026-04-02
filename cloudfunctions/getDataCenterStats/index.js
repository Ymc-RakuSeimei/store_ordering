const cloud = require('wx-server-sdk');

const ENV_ID = 'cloud1-2gltiqs6a2c5cd76';
const PAGE_SIZE = 100;
const PERIODS = new Set(['year', 'month', 'week', 'day']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

cloud.init({ env: ENV_ID });

const db = cloud.database();

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfWeek(date) {
  const start = getStartOfDay(date);
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  return start;
}

function getStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getStartOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function createRange(period, now) {
  if (period === 'year') {
    const start = getStartOfYear(now);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const buckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      label: `${monthIndex + 1}月`,
      start: new Date(now.getFullYear(), monthIndex, 1),
      end: new Date(now.getFullYear(), monthIndex + 1, 1)
    }));

    return {
      start,
      end,
      periodLabel: `${now.getFullYear()}年`,
      xAxisTitle: '月份',
      buckets
    };
  }

  if (period === 'month') {
    const start = getStartOfMonth(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const totalDays = Math.round((end - start) / MS_PER_DAY);
    const buckets = Array.from({ length: totalDays }, (_, dayIndex) => ({
      label: `${dayIndex + 1}日`,
      start: addDays(start, dayIndex),
      end: addDays(start, dayIndex + 1)
    }));

    return {
      start,
      end,
      periodLabel: `${now.getFullYear()}年${now.getMonth() + 1}月`,
      xAxisTitle: '日期',
      buckets
    };
  }

  if (period === 'week') {
    const weekNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const start = getStartOfWeek(now);
    const end = addDays(start, 7);
    const buckets = weekNames.map((label, index) => ({
      label,
      start: addDays(start, index),
      end: addDays(start, index + 1)
    }));

    return {
      start,
      end,
      periodLabel: `${start.getMonth() + 1}月${start.getDate()}日 - ${addDays(end, -1).getMonth() + 1}月${addDays(end, -1).getDate()}日`,
      xAxisTitle: '星期',
      buckets
    };
  }

  const start = getStartOfDay(now);
  const end = addDays(start, 1);
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    start: addHours(start, hour),
    end: addHours(start, hour + 1)
  }));

  return {
    start,
    end,
    periodLabel: `${now.getMonth() + 1}月${now.getDate()}日`,
    xAxisTitle: '小时',
    buckets
  };
}

async function assertMerchant(openid) {
  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  const user = (userRes.data || [])[0];

  if (!user || user.role !== 'merchant') {
    throw new Error('无权限访问数据中心');
  }
}

async function fetchAll(collectionName) {
  const countRes = await db.collection(collectionName).count();
  const total = countRes.total || 0;

  if (total === 0) {
    return [];
  }

  const tasks = [];
  for (let skip = 0; skip < total; skip += PAGE_SIZE) {
    tasks.push(
      db.collection(collectionName)
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
    );
  }

  const pages = await Promise.all(tasks);
  return pages.flatMap((page) => page.data || []);
}

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function buildGoodsInfoMap(goodsList) {
  return goodsList.reduce((map, item) => {
    if (!item) return map;

    const goodsInfo = {
      cost: Number(item.costPrice ?? item.cost) || 0,
      type: String(item.type || '')
    };

    [item._id, item.goodsId].forEach((candidateId) => {
      const normalizedId = normalizeId(candidateId);
      if (!normalizedId) return;
      map[normalizedId] = goodsInfo;
    });

    return map;
  }, {});
}

function createEmptyPoint(bucket) {
  return {
    label: bucket.label,
    revenue: 0,
    cost: 0,
    profit: 0
  };
}

function locateBucket(date, buckets) {
  const timestamp = date.getTime();
  return buckets.findIndex((bucket) => timestamp >= bucket.start.getTime() && timestamp < bucket.end.getTime());
}

function resolveGoodsInfo(item, goodsInfoMap) {
  const candidateIds = [item && item.goodsId, item && item.goodsDocId, item && item._id];

  for (const candidateId of candidateIds) {
    const normalizedId = normalizeId(candidateId);
    if (normalizedId && goodsInfoMap[normalizedId]) {
      return goodsInfoMap[normalizedId];
    }
  }

  return null;
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    await assertMerchant(OPENID);

    const period = PERIODS.has(event.period) ? event.period : 'month';
    const now = new Date();
    const range = createRange(period, now);

    const [orders, goodsList] = await Promise.all([
      fetchAll('orders'),
      fetchAll('goods')
    ]);

    const goodsInfoMap = buildGoodsInfoMap(goodsList);
    const points = range.buckets.map(createEmptyPoint);

    orders.forEach((order) => {
      const orderDate = normalizeDate(order.paytime || order.createdAt || order.updatedAt);
      const goods = Array.isArray(order.goods) ? order.goods : [];

      goods.forEach((item) => {
        if (!item) return;

        const goodsInfo = resolveGoodsInfo(item, goodsInfoMap) || {};
        const goodsType = goodsInfo.type || '';
        const goodsTypeNormalized = String(goodsType).toLowerCase();
        const unitCost = Number(goodsInfo.cost || 0) || 0;

        const quantity = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const revenueDelta = price * quantity;
        const costDelta = unitCost * quantity;
        const profitDelta = revenueDelta - costDelta;

        if (goodsTypeNormalized === 'preorder' || goodsTypeNormalized.includes('preorder') || goodsTypeNormalized.includes('预定')) {
          // 预售：等取货后才计入（与库存从 totalBooked 减少一致）
          const pickupStatus = item.pickupStatus;
          if (pickupStatus !== '已取货' && pickupStatus !== '已完成') return;

          const pickupDate = normalizeDate(item.pickuptime || item.pickupTime || null);
          if (!pickupDate) return;
          if (pickupDate < range.start || pickupDate >= range.end) return;

          const bucketIndex = locateBucket(pickupDate, range.buckets);
          if (bucketIndex < 0) return;

          points[bucketIndex].revenue += revenueDelta;
          points[bucketIndex].cost += costDelta;
          points[bucketIndex].profit += profitDelta;
          return;
        }

        // 现货/特价：按下单时间计入（对应买家下单时库存变动）
        if (!orderDate) return;
        const orderBucketIndex = locateBucket(orderDate, range.buckets);
        if (orderBucketIndex < 0) return;

        points[orderBucketIndex].revenue += revenueDelta;
        points[orderBucketIndex].cost += costDelta;
        points[orderBucketIndex].profit += profitDelta;
      });
    });

    const summary = points.reduce((result, point) => {
      result.revenue += point.revenue;
      result.cost += point.cost;
      result.profit += point.profit;
      return result;
    }, { revenue: 0, cost: 0, profit: 0 });

    const yMax = points.reduce((maxValue, point) => {
      const pointMax = Math.max(point.revenue, point.cost, point.profit, 0);
      return Math.max(maxValue, pointMax);
    }, 0);

    return {
      code: 0,
      message: 'ok',
      data: {
        period,
        periodLabel: range.periodLabel,
        xAxisTitle: range.xAxisTitle,
        summary: {
          revenue: Number(summary.revenue.toFixed(2)),
          cost: Number(summary.cost.toFixed(2)),
          profit: Number(summary.profit.toFixed(2))
        },
        chart: {
          yMax: yMax > 0 ? Number((yMax * 1.1).toFixed(2)) : 0,
          points: points.map((point) => ({
            label: point.label,
            revenue: Number(point.revenue.toFixed(2)),
            cost: Number(point.cost.toFixed(2)),
            profit: Number(point.profit.toFixed(2))
          }))
        }
      }
    };
  } catch (error) {
    console.error('getDataCenterStats error', error);
    return {
      code: -1,
      message: error.message || '获取数据中心统计失败',
      data: null
    };
  }
};
