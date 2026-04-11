Page({
  data: {
    feedbackId: '',
    feedback: null,
    loading: true,
    replyContent: '',
    replyLoading: false
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
  },

  // 回复内容输入
  onReplyInput(e) {
    this.setData({ replyContent: e.detail.value });
  },

  // 提交商家回复
  async submitReply() {
    const { feedback, replyContent } = this.data;

    if (!replyContent || replyContent.trim() === '') {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }

    this.setData({ replyLoading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'submitFeedbackReply',
        data: {
          feedbackId: feedback._id || feedback.id,
          replyContent: replyContent.trim()
        }
      });

      if (res.result.success) {
        wx.showToast({ title: '回复成功', icon: 'success' });
        // 更新本地数据
        const updatedFeedback = res.result.data;
        this.setData({
          feedback: updatedFeedback,
          replyContent: '',
          replyLoading: false
        });
      } else {
        this.setData({ replyLoading: false });
        wx.showToast({ title: res.result.message || '回复失败', icon: 'none' });
      }
    } catch (err) {
      console.error('提交回复失败', err);
      this.setData({ replyLoading: false });
      wx.showToast({ title: '回复失败，请重试', icon: 'none' });
    }
  }
});
