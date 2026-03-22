Page({
  data: {
    // 选中tab：现货/特价
    activeTab: 'stock',
    tabs: [
      { id: 'stock', label: '现货' },
      { id: 'special', label: '特价处理' }
    ],

    // 商品列表数据（从后端拉取）
    stockList: [],
    specialList: [],

    // 编辑弹窗和添加弹窗控制
    showEditDialog: false,
    editItem: null,
    editSellPrice: '',
    editCostPrice: '',

    showAddDialog: false,
    newProduct: { name: '', spec: '', sellPrice: '', costPrice: '', stock: '' }
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '商品管理' });
    this.loadGoods();
  },

  onBack() {
    wx.navigateBack();
  },

  // tab 切换
  switchTab(e) {
    const key = e.currentTarget.dataset.tab;
    this.setData({ activeTab: key });
  },

  // 打开修改弹窗
  openEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditDialog: true,
      editItem: item,
      editSellPrice: String(item.sellPrice || ''),
      editCostPrice: String(item.costPrice || '')
    });
  },

  closeEdit() {
    this.setData({ showEditDialog: false, editItem: null });
  },

  // 修改价格输入
  bindEditChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    if (key === 'sellPrice') this.setData({ editSellPrice: value });
    if (key === 'costPrice') this.setData({ editCostPrice: value });
  },

  // 保存修改：要调用后端 updateProduct 接口
  saveEdit() {
    const item = this.data.editItem;
    const sellPrice = Number(this.data.editSellPrice);
    const costPrice = Number(this.data.editCostPrice);

    if (!item || Number.isNaN(sellPrice) || Number.isNaN(costPrice)) {
      wx.showToast({ title: '请输入正确价格', icon: 'none' });
      return;
    }

    // 先调用后端接口（函数名应由后端实现）
    this.updateProductOnServer({
      id: item._id || item.id,
      sellPrice,
      costPrice
    }).then(() => {
      const key = this.data.activeTab === 'stock' ? 'stockList' : 'specialList';
      const list = this.data[key].map(i => {
        if ((i._id || i.id) === (item._id || item.id)) {
          return { ...i, sellPrice, costPrice };
        }
        return i;
      });
      this.setData({ [key]: list, showEditDialog: false, editItem: null });
      wx.showToast({ title: '修改成功', icon: 'success' });
    }).catch(err => {
      console.error('updateProductOnServer失败', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  // 打开添加弹窗
  openAdd() {
    this.setData({
      showAddDialog: true,
      newProduct: { name: '', spec: '', sellPrice: '', costPrice: '', stock: '' }
    });
  },

  closeAdd() {
    this.setData({ showAddDialog: false });
  },

  bindAddInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`newProduct.${field}`]: value });
  },

  // 添加商品：调用后端 addProduct 接口
  saveAdd() {
    const p = this.data.newProduct;
    if (!p.name || !p.spec || !p.sellPrice || !p.costPrice || !p.stock) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    const payload = {
      name: p.name,
      spec: p.spec,
      sellPrice: Number(p.sellPrice),
      costPrice: Number(p.costPrice),
      stock: Number(p.stock),
      special: this.data.activeTab === 'special',
      img: p.img || '/images/goods4.jpg' // 默认图，可上传后替换
    };

    this.addProductToServer(payload).then(result => {
      const item = { ...payload, _id: result._id || Date.now() };
      const key = this.data.activeTab === 'stock' ? 'stockList' : 'specialList';
      this.setData({ [key]: [...this.data[key], item], showAddDialog: false, newProduct: { name: '', spec: '', sellPrice: '', costPrice: '', stock: '' } });
      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch(err => {
      console.error('addProductToServer失败', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  // ----------------- 后端接口函数（前端调用即可） -----------------

  /**
   * 拉取商品列表（后端API）
   * 这里不写具体实现，只给函数名字并保留调用点
   */
  fetchGoodsFromServer() {
    // TODO: 后端实现该接口，这里先提供本地占位数据，方便前端开发联调。
    // 后端接口示例：wx.cloud.callFunction({ name: 'fetchGoods', data: {} })
    // 期望返回结构：{ stock: [...], special: [...] }

    return Promise.resolve({
      stock: [
        { _id: 'p001', name: '派大星同款手套气球', spec: '50个/袋', sellPrice: 18.00, costPrice: 12.00, stock: 100 },
        { _id: 'p002', name: '海绵宝宝同款领带', spec: '1条', sellPrice: 20.00, costPrice: 14.00, stock: 60 }
      ],
      special: [
        { _id: 'p101', name: '海绵宝宝特价套餐', spec: '10套', sellPrice: 150.00, costPrice: 120.00, stock: 30 }
      ]
    });
  },

  /**
   * 新增商品（后端API）
   */
  addProductToServer(product) {
    // TODO: 调用后端接口，例如 wx.cloud.callFunction({ name: 'addProduct', data: product })
    return Promise.resolve({ _id: new Date().getTime().toString() });
  },

  /**
   * 更新商品（后端API）
   */
  updateProductOnServer(updateInfo) {
    // TODO: 调用后端接口，例如 wx.cloud.callFunction({ name: 'updateProduct', data: updateInfo })
    return Promise.resolve();
  },

  /**
   * 加载商品数据并放到页面state
   */
  loadGoods() {
    this.fetchGoodsFromServer().then(res => {
      this.setData({
        stockList: res.stock || [],
        specialList: res.special || []
      });
    }).catch(err => {
      console.error('fetchGoodsFromServer失败', err);
      wx.showToast({ title: '加载商品失败', icon: 'none' });
    });
  }
});