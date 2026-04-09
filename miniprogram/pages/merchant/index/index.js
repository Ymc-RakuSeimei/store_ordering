// pages/merchant/index/index.js
Page({
  data: {
    userName: '店长ymc',
    avatar: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/avatar.png',
    cardGroup: [
      { id: 'product', title: '商品管理', subtitle: '上架新品、编辑库存', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_product.png' },
      { id: 'order', title: '订单处理', subtitle: '顾客订单、售后提醒', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_ord.png' },
      { id: 'data', title: '数据中心', subtitle: '销售统计、营收查看', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_data.png' },
      { id: 'preorder', title: '预售接龙', subtitle: '设置群接龙、统计进货', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_preord.png' }
    ],
    notify: { id: 'notify', title: '系统通知', subtitle: '库存、订单、预售提醒', icon: 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/icon_notice.png' }
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '商家管理' });
  },

  onScanPickup() {
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const code = res.result;
        if (!code) {
          wx.showToast({ title: '扫码结果为空', icon: 'none' });
          return;
        }
        wx.navigateTo({
          url: `/pages/merchant/verify/verify?code=${encodeURIComponent(code)}`
        });
      },
      fail: () => {
        wx.showToast({ title: '扫码失败，请重试', icon: 'none' });
      }
    });
  },

  onCardTap(event) {
    const id = event.currentTarget.dataset.id;
    const map = {
      product: '/pages/merchant/product/product',
      order: '/pages/merchant/order/order',
      data: '/pages/merchant/datacenter/datacenter',
      preorder: '/pages/merchant/preorder/preorder',
      notify: '/pages/merchant/notification/notification'
    };
    const url = map[id];
    if (url) {
      wx.navigateTo({ url });
    }
  },

  openAiAssistant() {
    wx.navigateTo({
      url: '/pages/ai-assistant/index?role=merchant'
    });
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') return;

    const map = {
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my'
    };
    const url = map[tab];
    if (url) {
      wx.redirectTo({ url });
    }
  }
});
