const PERIOD_OPTIONS = [
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' }
];

const METRIC_STYLES = {
  revenue: { label: '总收入', color: '#1f8f55' },
  cost: { label: '总成本', color: '#d97706' },
  profit: { label: '总利润', color: '#2563eb' }
};

const DEFAULT_SUMMARY = {
  revenue: 0,
  cost: 0,
  profit: 0
};

Page({
  data: {
    loading: true,
    activePeriod: 'month',
    periods: PERIOD_OPTIONS,
    summaryCards: [
      {
        key: 'revenue',
        label: METRIC_STYLES.revenue.label,
        value: '0.00',
        color: METRIC_STYLES.revenue.color
      },
      {
        key: 'cost',
        label: METRIC_STYLES.cost.label,
        value: '0.00',
        color: METRIC_STYLES.cost.color
      },
      {
        key: 'profit',
        label: METRIC_STYLES.profit.label,
        value: '0.00',
        color: METRIC_STYLES.profit.color
      }
    ],
    chartLegend: [],
    chartMeta: {
      periodLabel: '',
      xAxisTitle: ''
    },
    emptyText: '当前时间范围内暂无数据'
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '数据中心' });
  },

  onShow() {
    this.loadDataCenter();
  },

  onReady() {
    this.initChartCanvas();
  },

  onUnload() {
    this.clearNumberAnimation();
  },

  async loadDataCenter(nextPeriod) {
    const activePeriod = nextPeriod || this.data.activePeriod;
    this.clearNumberAnimation();
    this.setData({ loading: true, activePeriod });

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getDataCenterStats',
        data: { period: activePeriod }
      });

      if (!result || result.code !== 0) {
        throw new Error(result?.message || '数据中心加载失败');
      }

      const payload = result.data || {};
      const summary = payload.summary || DEFAULT_SUMMARY;
      const chart = payload.chart || { points: [], yMax: 0 };
      const periodLabel = payload.periodLabel || '';
      const xAxisTitle = payload.xAxisTitle || '';

      this.chartPayload = chart;
      this.summaryTargets = summary;

      this.setData({
        loading: false,
        chartLegend: this.buildLegend(),
        chartMeta: {
          periodLabel,
          xAxisTitle
        }
      }, () => {
        this.initChartCanvas();
        this.animateSummary(summary, activePeriod);
        this.drawChart();
      });
    } catch (error) {
      console.error('loadDataCenter error', error);
      this.chartPayload = { points: [], yMax: 0 };
      this.summaryTargets = DEFAULT_SUMMARY;
      this.setData({
        loading: false,
        summaryCards: this.formatSummaryCards(DEFAULT_SUMMARY),
        chartLegend: this.buildLegend(),
        chartMeta: {
          periodLabel: '',
          xAxisTitle: ''
        }
      }, () => {
        this.initChartCanvas();
        this.drawChart();
      });
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
    }
  },

  onPeriodChange(event) {
    const { period } = event.currentTarget.dataset;
    if (!period || period === this.data.activePeriod) {
      return;
    }

    this.loadDataCenter(period);
  },

  initChartCanvas() {
    if (this.chartCanvas && this.chartContext && this.chartSize) {
      this.drawChart();
      return;
    }

    const query = wx.createSelectorQuery().in(this);
    query.select('#trend-chart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasNode = res && res[0];
        if (!canvasNode || !canvasNode.node) {
          return;
        }

        const { node, width, height } = canvasNode;
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
        this.chartCanvas = node;
        this.chartContext = node.getContext('2d');
        this.chartSize = { width, height, dpr };
        node.width = width * dpr;
        node.height = height * dpr;
        this.chartContext.scale(dpr, dpr);
        this.drawChart();
      });
  },

  drawChart() {
    if (!this.chartCanvas || !this.chartContext || !this.chartSize) {
      return;
    }

    const { width, height } = this.chartSize;
    const ctx = this.chartContext;
    const chart = this.chartPayload || { points: [], yMax: 0 };
    const points = Array.isArray(chart.points) ? chart.points : [];

    ctx.clearRect(0, 0, width, height);
    this.drawChartBackground(ctx, width, height);

    if (!points.length) {
      this.drawChartEmptyState(ctx, width, height);
      return;
    }

    const padding = { top: 24, right: 16, bottom: 38, left: 56 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const yMax = chart.yMax > 0 ? chart.yMax : 1;
    const yStepValue = yMax / 4;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let index = 0; index <= 4; index += 1) {
      const y = padding.top + chartHeight - (chartHeight / 4) * index;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const labelValue = this.formatAxisValue(yStepValue * index);
      ctx.fillText(labelValue, padding.left - 8, y);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelIndexes = this.pickXAxisIndexes(points.length);
    labelIndexes.forEach((pointIndex) => {
      const point = points[pointIndex];
      const x = this.getPointX(pointIndex, points.length, padding.left, chartWidth);
      ctx.fillText(point.label, x, height - padding.bottom + 12);
    });
    ctx.restore();

    Object.keys(METRIC_STYLES).forEach((metricKey) => {
      this.drawMetricLine({
        ctx,
        metricKey,
        points,
        padding,
        chartWidth,
        chartHeight,
        yMax
      });
    });
  },

  drawChartBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f8fbff');
    gradient.addColorStop(1, '#eef6ff');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },

  drawChartEmptyState(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.data.emptyText, width / 2, height / 2);
    ctx.restore();
  },

  drawMetricLine({ ctx, metricKey, points, padding, chartWidth, chartHeight, yMax }) {
    const style = METRIC_STYLES[metricKey];
    const coordinates = points.map((item, index) => ({
      x: this.getPointX(index, points.length, padding.left, chartWidth),
      y: padding.top + chartHeight - (Math.max(item[metricKey] || 0, 0) / yMax) * chartHeight,
      value: item[metricKey] || 0
    }));

    if (!coordinates.length) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    coordinates.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.stroke();

    coordinates.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = style.color;
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  },

  getPointX(index, total, startX, chartWidth) {
    if (total <= 1) {
      return startX + chartWidth / 2;
    }

    return startX + (chartWidth / (total - 1)) * index;
  },

  pickXAxisIndexes(total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index);
    }

    const lastIndex = total - 1;
    const step = Math.max(1, Math.floor(lastIndex / 4));
    const indexes = [0];

    for (let index = step; index < lastIndex; index += step) {
      indexes.push(index);
    }

    if (indexes[indexes.length - 1] !== lastIndex) {
      indexes.push(lastIndex);
    }

    return indexes;
  },

  animateSummary(summary, periodKey) {
    this.clearNumberAnimation();

    const duration = 680;
    const startedAt = Date.now();

    const tick = () => {
      const progress = Math.min((Date.now() - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = {
        revenue: summary.revenue * easedProgress,
        cost: summary.cost * easedProgress,
        profit: summary.profit * easedProgress
      };

      this.setData({
        activePeriod: periodKey,
        summaryCards: this.formatSummaryCards(current)
      });

      if (progress >= 1) {
        this.animationTimer = null;
      } else {
        this.animationTimer = setTimeout(tick, 16);
      }
    };

    tick();
  },

  clearNumberAnimation() {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  },

  formatSummaryCards(summary) {
    return [
      {
        key: 'revenue',
        label: METRIC_STYLES.revenue.label,
        value: this.formatMoney(summary.revenue),
        color: METRIC_STYLES.revenue.color
      },
      {
        key: 'cost',
        label: METRIC_STYLES.cost.label,
        value: this.formatMoney(summary.cost),
        color: METRIC_STYLES.cost.color
      },
      {
        key: 'profit',
        label: METRIC_STYLES.profit.label,
        value: this.formatMoney(summary.profit),
        color: METRIC_STYLES.profit.color
      }
    ];
  },

  buildLegend() {
    return Object.keys(METRIC_STYLES).map((key) => ({
      key,
      label: METRIC_STYLES[key].label,
      color: METRIC_STYLES[key].color
    }));
  },

  formatMoney(value) {
    const amount = Number(value) || 0;
    const sign = amount < 0 ? '-' : '';
    const absolute = Math.abs(amount);
    const [integerPart, decimalPart] = absolute.toFixed(2).split('.');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${formattedInteger}.${decimalPart}`;
  },

  formatAxisValue(value) {
    const amount = Number(value) || 0;
    if (amount >= 10000) {
      return `${(amount / 10000).toFixed(1)}w`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`;
    }
    return amount.toFixed(0);
  }
});
