// pages/customer/goods/newgoods.js
Page({
  // 页面初始数据
  data: {
    // 商品列表数据（从云开发数据库加载）
    list: [],
    // 是否正在加载中（用于显示加载提示或占位）
    loading: true,
  },

  // 生命周期函数：页面加载完成时触发
  onLoad() {
    // 初次进页面立即请求商品数据
    this.fetchNewGoods();
  },

  // 统一从云函数获取“今日上新”商品列表
  fetchNewGoods() {
    // 进入加载状态
    this.setData({ loading: true });

    // 调用云函数，实际逻辑在 cloudfunctions/getNewGoods/index.js 中编写
    // 文件名称 getNewGoods 与下方 name 一样，需先在云开发中部署
    wx.cloud.callFunction({
      name: 'getNewGoods',
      data: {
        // 一次读取最大数量，灵活调整
        limit: 30,
        // page: 0,         // 可选：分页参数
        // sortField: 'createdAt',
        // sortOrder: 'desc',
      },
    })
      .then((res) => {
        // 增加云函数统一返回码判断，提升稳定性
        const result = res.result || {};
        if (result.code !== 0) {
          console.error('getNewGoods 业务异常', result);
          wx.showToast({
            title: result.message || '商品加载出错',
            icon: 'none',
          });
          this.setData({ loading: false });
          return;
        }

        const list = Array.isArray(result.data) ? result.data : [];
        this.setData({
          list,
          loading: false,
        });
      })
      .catch((err) => {
        // 调用失败（网络、权限、云函数异常等）
        console.error('getNewGoods failed', err);
        wx.showToast({
          title: '商品加载失败',
          icon: 'none',
        });
        this.setData({ loading: false });
      })
      .finally(() => {
        // 无论成功或失败，都停止下拉刷新动画（如果是下拉刷新触发）
        wx.stopPullDownRefresh();
      });
  },

  // 用户下拉刷新时触发，重新拉取数据
  onPullDownRefresh() {
    this.fetchNewGoods();
  },

  // 商品卡片点击跳转至商品详情页（传递 goodsId）
  goToDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/customer/goods/goods?goodsId=${id}`,
    });
  },

  // 点击按钮“立即预定”也跳到详情页，并附加 action=order 标记
  onOrderTap(event) {
    // 阻止事件冒泡，避免触发卡片整体 goToDetail
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/customer/goods/goods?goodsId=${id}&action=order`,
    });
  },

  // 分享当前页面设置（可选）
  onShareAppMessage() {
    return {
      title: '今日上新',
      path: '/pages/customer/goods/newgoods/newgoods',
    };
  },
});