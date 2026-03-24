// pages/customer/my/my.js
Page({
  data: {
    avatarUrl: '/images/avatar.png',
    helloName: '',

    // 展示数据（个人信息卡片）
    storeName: '',
    address: '',
    nickname: '',
    phone: '',
    githubUrl: '',

    // 编辑弹窗
    editing: false,
    draft: {
      storeName: '',
      address: '',
      nickname: '',
      phone: '',
      githubUrl: ''
    }
  },

  onLoad() {
    this.loadPersonalInfo();
  },

  onEditTap() {
    // 打开编辑时，用当前展示数据初始化草稿
    this.setData({
      editing: true,
      draft: {
        storeName: this.data.storeName,
        address: this.data.address,
        nickname: this.data.nickname,
        phone: this.data.phone,
        githubUrl: this.data.githubUrl
      }
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
    const payload = {
      storeName: this.data.draft.storeName,
      address: this.data.draft.address,
      nickname: this.data.draft.nickname,
      phone: this.data.draft.phone,
      githubUrl: this.data.draft.githubUrl
    };

    this.updatePersonalInfoOnServer(payload)
      .then(() => this.loadPersonalInfo())
      .then(() => this.setData({ editing: false }))
      .catch(() => wx.showToast({ title: '更新失败', icon: 'none' }));
  },

  // ================== 后端接口（仅函数名/调用，不写具体实现） ==================
  loadPersonalInfo() {
    return this.getPersonalInfoOnServer()
      .then(profile => {
        const safeProfile = profile || {};
        this.setData({
          // 下面字段建议由后端返回同名 key
          avatarUrl: safeProfile.avatarUrl || this.data.avatarUrl,
          helloName: safeProfile.helloName || safeProfile.nickname || this.data.helloName,
          storeName: safeProfile.storeName || '',
          address: safeProfile.address || '',
          nickname: safeProfile.nickname || '',
          phone: safeProfile.phone || '',
          githubUrl: safeProfile.githubUrl || ''
        });
      })
      .catch(() => {
        // 如果后端未实现，保持页面可用
        this.setData({
          helloName: this.data.nickname || this.data.helloName || '用户',
        });
      });
  },

  // 获取个人信息：建议返回 { avatarUrl, helloName/nickname, storeName, address, nickname, phone, githubUrl }
  getPersonalInfoOnServer() {
    return Promise.resolve({});
  },

  // 更新个人信息：入参 payload 建议包含 { storeName, address, nickname, phone, githubUrl }
  updatePersonalInfoOnServer(payload) {
    return Promise.resolve();
  }
});