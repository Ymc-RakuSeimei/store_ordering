Page({
  data: {
    avatarUrl: '/images/avatar.png',
    helloName: 'ymc',
    scanText: '扫码取货',
    profile: {
      storeName: 'MC_Store',
      address: 'A市B区C街D号',
      wechat: 'wxzh123',
      phone: '1234562345',
      githubUrl: 'https://github.com/Ymc-RakuSeimei/store_ordering'
    },
    editing: false,
    draft: {
      storeName: '',
      address: '',
      wechat: '',
      phone: '',
      githubUrl: ''
    }
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '我的' });
    this.loadMerchantProfile();
  },

  loadMerchantProfile() {
    this.getMerchantProfileFromDB()
      .then((res) => {
        const safe = res || {};
        this.setData({
          avatarUrl: safe.avatarUrl || this.data.avatarUrl,
          helloName: safe.helloName || this.data.helloName,
          profile: {
            storeName: safe.storeName || this.data.profile.storeName,
            address: safe.address || this.data.profile.address,
            wechat: safe.wechat || this.data.profile.wechat,
            phone: safe.phone || this.data.profile.phone,
            githubUrl: safe.githubUrl || this.data.profile.githubUrl
          }
        });
      })
      .catch(() => {
        wx.showToast({ title: '使用占位数据展示', icon: 'none' });
      });
  },

  onScanPickup() {
    wx.scanCode({
      onlyFromCamera: true,
      fail: () => wx.showToast({ title: '扫码失败，请重试', icon: 'none' })
    });
  },

  onEditTap() {
    this.setData({
      editing: true,
      draft: { ...this.data.profile }
    });
  },

  onCancelEdit() {
    this.setData({ editing: false });
  },

  onDraftInput(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    this.setData({ [`draft.${key}`]: value });
  },

  onSaveEdit() {
    const payload = { ...this.data.draft };
    this.updateMerchantProfileToDB(payload)
      .then(() => {
        this.setData({
          profile: payload,
          editing: false
        });
        wx.showToast({ title: '修改成功', icon: 'success' });
      })
      .catch(() => wx.showToast({ title: '上传失败', icon: 'none' }));
  },

  // 后端实现：从数据库读取商家资料
  getMerchantProfileFromDB() {
    // TODO: 后端补充数据库查询逻辑
    return Promise.resolve({
      storeName: 'MC_Store',
      address: 'A市B区C街D号',
      wechat: 'wxzh123',
      phone: '1234562345',
      githubUrl: 'https://github.com/Ymc-RakuSeimei/store_ordering'
    });
  },

  // 后端实现：将修改后的资料上传数据库
  updateMerchantProfileToDB(payload) {
    // TODO: 后端补充数据库更新逻辑
    return Promise.resolve(payload);
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'my') return;
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my'
    };
    const url = map[tab];
    if (url) wx.navigateTo({ url });
  }
});
