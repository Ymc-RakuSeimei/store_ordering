const PERIOD_OPTIONS = [
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' }
];

const METRIC_STYLES = {
  revenue: { label: '总收入', color: '#235977' },
  cost: { label: '总成本', color: '#dc843f' },
  profit: { label: '总利润', color: '#3d8c95' }
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
    this.clearChartAnimation();
  },

  async loadDataCenter(nextPeriod) {
    const activePeriod = nextPeriod || this.data.activePeriod;
    this.clearNumberAnimation();
    this.clearChartAnimation();
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
        this.startChartAnimation();
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
        this.startChartAnimation();
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
    const animationProgress = typeof this.chartAnimationProgress === 'number'
      ? this.chartAnimationProgress
      : 1;

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
    ctx.strokeStyle = 'rgba(17, 17, 17, 0.08)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6a6a6a';
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
        yMax,
        animationProgress
      });
    });
  },

  drawChartBackground(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#f5f5f5');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.78, height * 0.18, 0, width * 0.78, height * 0.18, width * 0.44);
    glow.addColorStop(0, 'rgba(79, 107, 255, 0.08)');
    glow.addColorStop(1, 'rgba(79, 107, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },

  drawChartEmptyState(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = '#8a8a8a';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.data.emptyText, width / 2, height / 2);
    ctx.restore();
  },

  drawMetricLine({ ctx, metricKey, points, padding, chartWidth, chartHeight, yMax, animationProgress }) {
    const style = METRIC_STYLES[metricKey];
    const coordinates = points.map((item, index) => ({
      x: this.getPointX(index, points.length, padding.left, chartWidth),
      y: padding.top + chartHeight - (Math.max(item[metricKey] || 0, 0) / yMax) * chartHeight,
      value: item[metricKey] || 0
    }));
    const animatedCoordinates = this.getAnimatedCoordinates(coordinates, animationProgress);

    if (!coordinates.length || !animatedCoordinates.length) {
      return;
    }

    ctx.save();
    const areaGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    areaGradient.addColorStop(0, this.hexToRgba(style.color, 0.14));
    areaGradient.addColorStop(1, this.hexToRgba(style.color, 0));
    ctx.beginPath();
    animatedCoordinates.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.lineTo(animatedCoordinates[animatedCoordinates.length - 1].x, padding.top + chartHeight);
    ctx.lineTo(animatedCoordinates[0].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = areaGradient;
    ctx.fill();

    ctx.strokeStyle = style.color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    animatedCoordinates.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.stroke();

    const visiblePointCount = Math.max(0, animatedCoordinates.length - 1);
    coordinates.slice(0, visiblePointCount).forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.arc(point.x, point.y, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = style.color;
      ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  },

  getAnimatedCoordinates(coordinates, progress) {
    if (!Array.isArray(coordinates) || !coordinates.length) {
      return [];
    }

    if (coordinates.length === 1 || progress >= 1) {
      return coordinates.slice();
    }

    const clampedProgress = Math.max(0, Math.min(progress, 1));
    const totalSegments = coordinates.length - 1;
    const scaledProgress = clampedProgress * totalSegments;
    const completedSegments = Math.floor(scaledProgress);
    const partialProgress = scaledProgress - completedSegments;
    const animated = coordinates.slice(0, completedSegments + 1);

    if (completedSegments < totalSegments) {
      const startPoint = coordinates[completedSegments];
      const endPoint = coordinates[completedSegments + 1];
      animated.push({
        x: startPoint.x + (endPoint.x - startPoint.x) * partialProgress,
        y: startPoint.y + (endPoint.y - startPoint.y) * partialProgress,
        value: startPoint.value + (endPoint.value - startPoint.value) * partialProgress
      });
    }

    return animated;
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
    const targetLabelCount = 5;
    const indexes = [];

    for (let step = 0; step < targetLabelCount; step += 1) {
      const ratio = step / (targetLabelCount - 1);
      const index = Math.round(lastIndex * ratio);

      if (indexes[indexes.length - 1] !== index) {
        indexes.push(index);
      }
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

  startChartAnimation() {
    this.clearChartAnimation();
    const points = this.chartPayload && Array.isArray(this.chartPayload.points)
      ? this.chartPayload.points
      : [];

    if (!points.length) {
      this.chartAnimationProgress = 1;
      this.drawChart();
      return;
    }

    const duration = 1600;
    const startedAt = Date.now();
    this.chartAnimationProgress = 0;

    const tick = () => {
      const progress = Math.min((Date.now() - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.chartAnimationProgress = easedProgress;
      this.drawChart();

      if (progress >= 1) {
        this.chartAnimationTimer = null;
      } else {
        this.chartAnimationTimer = setTimeout(tick, 16);
      }
    };

    tick();
  },

  clearChartAnimation() {
    if (this.chartAnimationTimer) {
      clearTimeout(this.chartAnimationTimer);
      this.chartAnimationTimer = null;
    }
    this.chartAnimationProgress = 1;
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

  hexToRgba(hex, alpha) {
    const normalizedHex = String(hex || '').replace('#', '');
    const safeHex = normalizedHex.length === 3
      ? normalizedHex.split('').map((char) => char + char).join('')
      : normalizedHex;

    if (safeHex.length !== 6) {
      return `rgba(17, 17, 17, ${alpha})`;
    }

    const red = parseInt(safeHex.slice(0, 2), 16);
    const green = parseInt(safeHex.slice(2, 4), 16);
    const blue = parseInt(safeHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
