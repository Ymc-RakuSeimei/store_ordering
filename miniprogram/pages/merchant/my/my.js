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

  // 点击头像更换头像
  onAvatarClick() {
    wx.chooseMedia({
      count: 1, // 只选1张图片
      mediaType: ['image'], // 只允许选择图片
      sourceType: ['album', 'camera'], // 支持相册选择和拍照
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 上传头像到服务器
        this.uploadAvatarToServer(tempFilePath)
          .then(avatarUrl => {
            this.setData({ avatarUrl });
            wx.showToast({ title: '头像更新成功', icon: 'success' });
          })
          .catch(err => {
            console.error('头像上传失败', err);
            wx.showToast({ title: '头像上传失败', icon: 'none' });
          });
      },
      fail: () => {
        wx.showToast({ title: '取消选择', icon: 'none' });
      }
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
    // TODO: 后端补充数据库查询逻辑，包含avatarUrl字段
    return Promise.resolve({
      avatarUrl: '/images/avatar.png', // 商家头像地址
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

  // 后端实现：上传头像到存储服务并更新商家信息
  uploadAvatarToServer(tempFilePath) {
    // TODO: 后端需要实现的逻辑：
    // 1. 将前端传来的临时图片路径上传到云存储/OSS等存储服务
    // 2. 获取图片的永久访问URL或者云存储文件ID
    // 3. 更新数据库中当前商家的avatarUrl字段为新的头像地址
    // 4. 返回新的头像地址给前端更新显示
    // 示例云开发上传代码：
    // return wx.cloud.uploadFile({
    //   cloudPath: `merchant/avatar/${Date.now()}_${Math.random().toString(36).substr(2)}.png`,
    //   filePath: tempFilePath
    // }).then(res => {
    //   // 上传成功后更新数据库
    //   return wx.cloud.callFunction({
    //     name: 'updateMerchantAvatar',
    //     data: { avatarUrl: res.fileID }
    //   }).then(() => res.fileID);
    // });

    // 临时返回本地路径用于预览，后端接入时替换为真实逻辑
    return Promise.resolve(tempFilePath);
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
    if (url) wx.redirectTo({ url });
  }
});
