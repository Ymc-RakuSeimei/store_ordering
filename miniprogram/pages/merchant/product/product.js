const DEFAULT_PRODUCT_IMAGE = '/images/goods_sample.png';

// 页面上展示图片时，只接受这些常见可访问路径。
const isUsableImage = (value) => {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/');
};

// 新增商品弹窗的初始值统一放在一个函数里，便于重置表单。
const createEmptyNewProduct = () => ({
  name: '',
  spec: '',
  sellPrice: '',
  costPrice: '',
  stock: '',
  img: ''
});

// 云函数返回的是“前端可直接展示”的结构；
// 但为了兼容数据库真实字段，这里仍然兜底读取 specs / price / cost / images。
const normalizeProductItem = (item = {}, index = 0) => {
  const stableId = item._id || item.id || `goods_${index}`;
  const imageList = Array.isArray(item.images) ? item.images.filter(isUsableImage) : [];
  const image = [item.img, item.image, imageList[0]].find(isUsableImage) || DEFAULT_PRODUCT_IMAGE;

  return {
    ...item,
    _id: stableId,
    id: item.id || stableId,
    name: item.name || '',
    spec: item.spec || item.specs || '',
    sellPrice: Number(item.sellPrice ?? item.price) || 0,
    costPrice: Number(item.costPrice ?? item.cost) || 0,
    stock: Number.isNaN(Number(item.stock)) ? 0 : Number(item.stock),
    img: image
  };
};

Page({
  data: {
    // 当前选中的商品分类。
    activeTab: 'stock',
    tabs: [
      { id: 'stock', label: '现货' },
      { id: 'special', label: '特价处理' }
    ],

    // 两类商品列表分别存储，切 tab 时只切显示，不重复请求。
    stockList: [],
    specialList: [],

    // 编辑商品弹窗相关状态。
    showEditDialog: false,
    editItem: null,
    editSellPrice: '',
    editCostPrice: '',
    editStock: '',
    editImg: '',

    // 新增商品弹窗相关状态。
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

  // 切换“现货 / 特价处理”两个 tab。
  switchTab(e) {
    const key = e.currentTarget.dataset.tab;
    this.setData({ activeTab: key });
  },

  // 打开编辑弹窗，并把当前商品的数据带进去。
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
    this.setData({
      showEditDialog: false,
      editItem: null
    });
  },

  // 编辑弹窗中的输入框共用一个方法，通过 data-key 区分字段。
  bindEditChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;

    if (key === 'sellPrice') this.setData({ editSellPrice: value });
    if (key === 'costPrice') this.setData({ editCostPrice: value });
    if (key === 'stock') this.setData({ editStock: value });
  },

  // 给编辑中的商品重新选图并上传到云存储。
  chooseEditImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFilePaths[0];
        const cloudPath = `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;

        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: (uploadRes) => {
            this.setData({ editImg: uploadRes.fileID });
            wx.showToast({ title: '图片上传成功', icon: 'success', duration: 1000 });
          },
          fail: (err) => {
            console.error('图片上传失败', err);
            wx.showToast({ title: '图片上传失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
      }
    });
  },

  // 新增商品时选择图片，逻辑和编辑时一致，只是写入 newProduct.img。
  chooseProductImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFile = res.tempFilePaths[0];
        const cloudPath = `goods/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;

        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempFile,
          success: (uploadRes) => {
            this.setData({ 'newProduct.img': uploadRes.fileID });
            wx.showToast({ title: '图片上传成功', icon: 'success', duration: 1000 });
          },
          fail: (err) => {
            console.error('图片上传失败', err);
            wx.showToast({ title: '图片上传失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
      }
    });
  },

  // 保存编辑后的商品。
  // 注意：前端传的是展示字段 sellPrice / costPrice / img，
  // 云函数会再转成数据库真实字段 price / cost / images。
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

    this.updateProductOnServer({
      id: item._id || item.id,
      sellPrice,
      costPrice,
      stock,
      img
    }).then((serverProduct) => {
      const key = this.data.activeTab === 'stock' ? 'stockList' : 'specialList';
      const list = this.data[key].map((currentItem, index) => {
        if ((currentItem._id || currentItem.id) === (item._id || item.id)) {
          return normalizeProductItem(
            serverProduct || { ...currentItem, sellPrice, costPrice, stock, img },
            index
          );
        }
        return currentItem;
      });

      this.setData({
        [key]: list,
        showEditDialog: false,
        editItem: null
      });

      wx.showToast({ title: '修改成功', icon: 'success' });
    }).catch((err) => {
      console.error('updateProductOnServer失败', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    });
  },

  // 打开新增商品弹窗。
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

  // 新增商品弹窗中的多个输入框复用同一个方法。
  bindAddInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({ [`newProduct.${field}`]: value });
  },

  // 新增商品。
  // 这里仍然提交前端字段，云函数内部会统一转换成 goods 集合真实字段格式。
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

    this.addProductToServer(payload).then((serverProduct) => {
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
    }).catch((err) => {
      console.error('addProductToServer失败', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

  // ----------------- 云函数调用封装 -----------------

  // 拉取商品列表。
  fetchGoodsFromServer() {
    return wx.cloud.callFunction({
      name: 'fetchGoods',
      data: {}
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '获取商品列表失败');
      }
      return result.data || { stock: [], special: [] };
    });
  },

  // 新增商品。
  addProductToServer(product) {
    return wx.cloud.callFunction({
      name: 'addProduct',
      data: product
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '添加商品失败');
      }
      return result.data ? result.data.product : null;
    });
  },

  // 更新商品。
  updateProductOnServer(updateInfo) {
    return wx.cloud.callFunction({
      name: 'updateProduct',
      data: updateInfo
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '更新商品失败');
      }
      return result.data ? result.data.product : null;
    });
  },

  // 页面初始化时拉取商品列表，并按现货 / 特价拆分到本地状态。
  loadGoods() {
    this.fetchGoodsFromServer().then((res) => {
      this.setData({
        stockList: (res.stock || []).map((item, index) =>
          normalizeProductItem({ ...item, special: false }, index)
        ),
        specialList: (res.special || []).map((item, index) =>
          normalizeProductItem({ ...item, special: true }, index)
        )
      });
    }).catch((err) => {
      console.error('fetchGoodsFromServer失败', err);
      wx.showToast({ title: '加载商品失败', icon: 'none' });
    });
  },

  // 商家底部导航。
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;

    // 当前页本身就是商品页，点击时不做跳转。
    if (tab === 'product') return;

    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my'
    };
    const url = map[tab];

    if (url) {
      wx.navigateTo({ url });
    }
  }
});
