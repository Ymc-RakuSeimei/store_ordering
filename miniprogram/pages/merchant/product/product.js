const DEFAULT_PRODUCT_IMAGE = 'cloud://cloud1-2gltiqs6a2c5cd76.636c-cloud1-2gltiqs6a2c5cd76-1411302136/icons/placeholder.png';

const isUsableImage = (value) => {
  if (typeof value !== 'string') return false;
  const image = value.trim();
  if (!image) return false;
  return image.startsWith('cloud://') || image.startsWith('http://') || image.startsWith('https://');
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
    activeTab: 'stock',
    tabs: [
      { id: 'stock', label: '现货' },
      { id: 'special', label: '特价处理' }
    ],
    stockList: [],
    specialList: [],
    showEditDialog: false,
    editItem: null,
    editSellPrice: '',
    editCostPrice: '',
    editStock: '',
    editImg: '',
    editDescription: '',
    showAddDialog: false,
    newProduct: createEmptyNewProduct(),
    loading: false,
    deleteLoading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '商品管理' });
    this.loadGoods();
  },

  onBack() {
    wx.navigateBack({
      delta: 1,
      fail: function () {
        wx.redirectTo({ url: '/pages/merchant/index/index' });
      }
    });
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.tab;
    this.setData({ activeTab: key });
  },

  openEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showEditDialog: true,
      editItem: item,
      editSellPrice: item.sellPrice === undefined || item.sellPrice === null ? '' : String(item.sellPrice),
      editCostPrice: item.costPrice === undefined || item.costPrice === null ? '' : String(item.costPrice),
      editStock: item.stock === undefined || item.stock === null ? '' : String(item.stock),
      editImg: item.img || DEFAULT_PRODUCT_IMAGE,
      editDescription: item.description === undefined || item.description === null ? '' : String(item.description)
    });
  },

  closeEdit() {
    this.setData({
      showEditDialog: false,
      editItem: null
    });
  },

  deleteProduct() {
    const item = this.data.editItem || {};
    const productName = item.name || '当前商品';
    const productId = item._id || item.id;

    wx.showModal({
      title: '删除商品',
      content: `确认删除"${productName}"吗？删除后当前商品将从商品列表中移除。`,
      confirmColor: '#e14d4d',
      success: (res) => {
        if (!res.confirm) return;

        if (!productId) {
          wx.showToast({ title: '商品ID异常', icon: 'none' });
          return;
        }

        this.setData({ deleteLoading: true });

        this.deleteProductOnServer({ id: productId })
          .then(() => {
            const listKey = item.special || item.type === 'special' ? 'specialList' : 'stockList';
            const nextList = (this.data[listKey] || []).filter(
              (currentItem) => (currentItem._id || currentItem.id) !== productId
            );

            this.setData({
              [listKey]: nextList,
              showEditDialog: false,
              editItem: null,
              deleteLoading: false
            });

            wx.showToast({ title: '删除成功', icon: 'success' });
          })
          .catch((err) => {
            console.error('deleteProductOnServer失败', err);
            this.setData({ deleteLoading: false });
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
      }
    });
  },

  bindEditChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;

    if (key === 'sellPrice') this.setData({ editSellPrice: value });
    if (key === 'costPrice') this.setData({ editCostPrice: value });
    if (key === 'stock') this.setData({ editStock: value });
    if (key === 'description') this.setData({ editDescription: value });
  },

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

  saveEdit() {
    const item = this.data.editItem;
    const sellPriceText = String(this.data.editSellPrice).trim();
    const costPriceText = String(this.data.editCostPrice).trim();
    const stockText = String(this.data.editStock).trim();
    const description = String(this.data.editDescription || '').trim();
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
      img,
      description
    }).then((serverProduct) => {
      const key = this.data.activeTab === 'stock' ? 'stockList' : 'specialList';
      const list = this.data[key].map((currentItem, index) => {
        if ((currentItem._id || currentItem.id) === (item._id || item.id)) {
          return normalizeProductItem(
            serverProduct || { ...currentItem, sellPrice, costPrice, stock, img, description },
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

      this.createNewGoodsNotification(item);

      wx.showToast({ title: '添加成功', icon: 'success' });
    }).catch((err) => {
      console.error('addProductToServer失败', err);
      wx.showToast({ title: '添加失败', icon: 'none' });
    });
  },

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

  deleteProductOnServer(payload) {
    return wx.cloud.callFunction({
      name: 'deleteProduct',
      data: payload
    }).then((res) => {
      const result = res.result || {};
      if (result.code !== 0) {
        throw new Error(result.message || '删除商品失败');
      }
      return result.data || null;
    });
  },

  loadGoods() {
    this.setData({ loading: true });
    this.fetchGoodsFromServer().then((res) => {
      this.setData({
        stockList: (res.stock || []).map((item, index) =>
          normalizeProductItem({ ...item, special: false }, index)
        ),
        specialList: (res.special || []).map((item, index) =>
          normalizeProductItem({ ...item, special: true }, index)
        ),
        loading: false
      });
    }).catch((err) => {
      console.error('fetchGoodsFromServer失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载商品失败', icon: 'none' });
    });
  },

  createNewGoodsNotification(product) {
    try {
      wx.cloud.callFunction({
        name: 'createMessage',
        data: {
          type: 'newgoods',
          title: '新品上市',
          content: '新品 ' + (product.name || '') + ' 已经上架，快来看看吧！',
          productId: product._id || product.id
        }
      });
    } catch (error) {
      console.error('生成上新通知失败:', error);
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;

    if (tab === 'product') return;

    const map = {
      home: '/pages/merchant/index/index',
      product: '/pages/merchant/product/product',
      my: '/pages/merchant/my/my'
    };
    const url = map[tab];

    if (url) {
      wx.redirectTo({ url });
    }
  }
});
