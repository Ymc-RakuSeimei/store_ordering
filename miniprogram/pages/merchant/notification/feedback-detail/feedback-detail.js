Page({
  data: {
    feedbackId: '',
    feedback: null,
    loading: true
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '反馈详情' });

    const feedbackId = options.id;
    if (feedbackId) {
      this.setData({ feedbackId });
      this.loadDetail(options);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: function() {
        wx.redirectTo({ url: '/pages/merchant/notification/notification' });
      }
    });
  },

  loadDetail(options) {
    // 如果从列表页传来了完整数据，直接用
    if (options.data) {
      try {
        const feedback = JSON.parse(decodeURIComponent(options.data));
        this.setData({ feedback, loading: false });
        return;
      } catch (e) {
        console.error('Parse feedback data error', e);
      }
    }

    // 否则重新加载（这里可以添加从云函数获取单个反馈的逻辑）
    this.setData({ loading: false });
  },

  onPreviewImage(e) {
    const current = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({
      current: current,
      urls: urls
    });
  }
});
