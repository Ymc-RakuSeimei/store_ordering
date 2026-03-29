const DEFAULT_PRODUCT_IMAGE = '/images/goods_sample.png';

const isUsableImage = value => {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/');
};

const createEmptyNewProduct = () => ({
  name: '',
  spec: '',
  sellPrice: '',
  costPrice: '',
  stock: '',
  img: ''
});

const normalizeProductItem = (item = {}, index = 0) => {
  const stableId = item._id || item.id || `goods_${index}`;
  const image = [item.img, item.image].find(isUsableImage) || DEFAULT_PRODUCT_IMAGE;

  return {
    ...item,
    _id: stableId,
    id: item.id || stableId,
    name: item.name || '',
    spec: item.spec || '',
    sellPrice: Number(item.sellPrice) || 0,
    costPrice: Number(item.costPrice) || 0,
    stock: Number.isNaN(Number(item.stock)) ? 0 : Number(item.stock),
    img: image
  };
};

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
    editStock: '',
    editImg: '',

    showAddDialog: false,
    newProduct: createEmptyNewProduct()
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
      editSellPrice: item.sellPrice === undefined || item.sellPrice === null ? '' : String(item.sellPrice),
      editCostPrice: item.costPrice === undefined || item.costPrice === null ? '' : String(item.costPrice),
      editStock: item.stock === undefined || item.stock === null ? '' : String(item.stock),
      editImg: item.img || DEFAULT_PRODUCT_IMAGE
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
    if (key === 'stock') this.setData({ editStock: value });
  },

  // 选择编辑时的商品图片
  chooseEditImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFile = res.tempFilePaths[0];
        // 上传到云存储
        const cloudPath = `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: uploadRes => {
            this.setData({ editImg: uploadRes.fileID });
            wx.showToast({ title: '图片上传成功', icon: 'success', duration: 1000 });
          },
          fail: err => {
            console.error('图片上传失败', err);
            wx.showToast({ title: '图片上传失败', icon: 'none' });
          }
        });
      },
      fail: err => {
        console.error('选择图片失败', err);
      }
    });
  },

  // 选择新增商品的图片
  chooseProductImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFile = res.tempFilePaths[0];
        const cloudPath = `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: uploadRes => {
            this.setData({ 'newProduct.img': uploadRes.fileID });
            wx.showToast({ title: '图片上传成功', icon: 'success', duration: 1000 });
          },
          fail: err => {
            console.error('图片上传失败', err);
            wx.showToast({ title: '图片上传失败', icon: 'none' });
          }
        });
      },
      fail: err => {
        console.error('选择图片失败', err);
      }
    });
  },

  // 保存修改：要调用后端 updateProduct 接口
  saveEdit() {
    const item = this.data.editItem;
    const sellPriceText = String(this.data.editSellPrice).trim();
    const costPriceText = String(this.data.editCostPrice).trim();
    const stockText = String(this.data.editStock).trim();
    const sellPrice = Number(sellPriceText);
    const costPrice = Number(costPriceText);
    const stock = Number(stockText);
    const img = this.data.editImg || item.img || DEFAULT_PRODUCT_IMAGE;

    if (
      !item ||
      sellPriceText === '' ||
      costPriceText === '' ||
      stockText === '' ||
      Number.isNaN(sellPrice) ||
      Number.isNaN(costPrice) ||
      !Number.isInteger(stock) ||
      sellPrice < 0 ||
      costPrice < 0 ||
      stock < 0
    ) {
      wx.showToast({ title: '请输入正确信息', icon: 'none' });
      return;
    }

    // 先调用后端接口（函数名应由后端实现）
    this.updateProductOnServer({
      id: item._id || item.id,
      sellPrice,
      costPrice,
      stock,
      img
    }).then(serverProduct => {
      const key = this.data.activeTab === 'stock' ? 'stockList' : 'specialList';
      const list = this.data[key].map((i, index) => {
        if ((i._id || i.id) === (item._id || item.id)) {
          return normalizeProductItem(serverProduct || { ...i, sellPrice, costPrice, stock, img }, index);
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
      newProduct: createEmptyNewProduct()
    });
  },

  closeAdd() {
    this.setData({
      showAddDialog: false,
      newProduct: createEmptyNewProduct()
    });
  },

  bindAddInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`newProduct.${field}`]: value });
  },

  // 添加商品：调用后端 addProduct 接口
  saveAdd() {
    const p = this.data.newProduct;
    const name = String(p.name || '').trim();
    const spec = String(p.spec || '').trim();
    const sellPriceText = String(p.sellPrice || '').trim();
    const costPriceText = String(p.costPrice || '').trim();
    const stockText = String(p.stock || '').trim();
    const sellPrice = Number(sellPriceText);
    const costPrice = Number(costPriceText);
    const stock = Number(stockText);

    if (
      !name ||
      !spec ||
      sellPriceText === '' ||
      costPriceText === '' ||
      stockText === '' ||
      Number.isNaN(sellPrice) ||
      Number.isNaN(costPrice) ||
      !Number.isInteger(stock) ||
      sellPrice < 0 ||
      costPrice < 0 ||
      stock < 0
    ) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    const payload = {
      name,
      spec,
      sellPrice,
      costPrice,
      stock,
      special: this.data.activeTab === 'special',
      img: p.img || DEFAULT_PRODUCT_IMAGE
    };

    this.addProductToServer(payload).then(serverProduct => {
      const key = this.data.activeTab === 'stock' ? 'stockList' : 'specialList';
      const item = normalizeProductItem(
        serverProduct || { ...payload, _id: Date.now() },
        this.data[key] ? this.data[key].length : 0
      );
      this.setData({
        [key]: [...this.data[key], item],
        showAddDialog: false,
        newProduct: createEmptyNewProduct()
      });
      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch(err => {
      console.error('addProductToServer失败', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  // ----------------- 后端接口函数（前端调用即可） -----------------

  /**
   * 拉取商品列表（后端API）
   */
  fetchGoodsFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchGoods',
      data: {}
    }).then(res => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取商品列表失败');
      }
      return result.data || { stock: [], special: [] };
    });
  },

  /**
   * 新增商品（后端API）
   */
  addProductToServer(product) {
    return wx.cloud.callFunction({
      name: 'addProduct',
      data: product
    }).then(res => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '添加商品失败');
      }
      return result.data ? result.data.product : null;
    });
  },

  /**
   * 更新商品（后端API）
   */
  updateProductOnServer(updateInfo) {
    return wx.cloud.callFunction({
      name: 'updateProduct',
      data: updateInfo
    }).then(res => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '更新商品失败');
      }
      return result.data ? result.data.product : null;
    });
  },

  /**
   * 加载商品数据并放到页面state
   */
  loadGoods() {
    this.fetchGoodsFromServer().then(res => {
      this.setData({
        stockList: (res.stock || []).map((item, index) =>
          normalizeProductItem({ ...item, special: false }, index)
        ),
        specialList: (res.special || []).map((item, index) =>
          normalizeProductItem({ ...item, special: true }, index)
        )
      });
    }).catch(err => {
      console.error('fetchGoodsFromServer失败', err);
      wx.showToast({ title: '加载商品失败', icon: 'none' });
    });
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    // 当前页为商品管理，不跳转
    if (tab === 'product') return;
    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my',
    };
    const url = map[tab];
    if (url) wx.navigateTo({ url });
  }
});
