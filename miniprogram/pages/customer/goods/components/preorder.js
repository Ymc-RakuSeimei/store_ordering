// pages/customer/goods/components/preorder/preorder.js
Component({
  properties: {
    searchKeyword: {
      type: String,
      value: '',
      observer: function(newVal) {
        this.filterGoods();
      }
    },
    goodsList: {
      type: Array,
      value: [],
      observer: function(newVal) {
        this.setData({ originalList: newVal });
        this.filterGoods();
      }
    }
  },

  data: {
    originalList: [],
    displayList: []
  },

  lifetimes: {
    attached() {
      this.setData({ originalList: this.properties.goodsList });
      this.filterGoods();
    }
  },

  methods: {
    // 格式化商品数据
    formatGoodsItem(item) {
      let imageUrl = '';
      if (item.images && item.images.length > 0 && item.images[0]) {
        imageUrl = item.images[0];
      }
      if (imageUrl && (imageUrl === '图一' || imageUrl === '图二')) {
        imageUrl = '';
      }
      
      // 使用父页面传递的购物车数量
      const cartQuantity = item.cartQuantity || 0;
      
      return {
        // 优先使用 goodsId 作为业务索引；老数据没有 goodsId 时回退到 _id。
        id: item.goodsId || item._id,
        name: item.name || '商品名称',
        price: item.price || 0,
        originalPrice: null,
        statusText: `已预定${item.totalBooked || 0}件`,
        spec: item.specs || '无规格',
        image: imageUrl,
        badgeText: '接龙预定',
        badgeClass: 'preorder',
        priceClass: '',
        actionText: '参与接龙',
        actionType: 'joinGroup',
        type: item.type,
        cartQuantity: cartQuantity
      };
    },

    // 筛选商品
    filterGoods() {
      let list = [...this.data.originalList];
      
      // 格式化数据
      list = list.map(item => this.formatGoodsItem(item));
      
      // 关键词筛选
      const keyword = this.properties.searchKeyword;
      if (keyword && keyword.trim()) {
        const lowerKeyword = keyword.toLowerCase().trim();
        list = list.filter(item => 
          item.name.toLowerCase().includes(lowerKeyword)
        );
      }
      
      this.setData({ displayList: list });
    },

    onAction(e) {
      const { item } = e.currentTarget.dataset;
      if (item.actionType === 'joinGroup') {
        this.triggerEvent('joinGroup', {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image
        });
      }
    },

    // 减少数量
    decreaseQuantity(e) {
      const { item } = e.currentTarget.dataset;
      this.triggerEvent('updateQuantity', {
        id: item.id,
        quantity: -1
      });
    },

    // 增加数量
    increaseQuantity(e) {
      const { item } = e.currentTarget.dataset;
      this.triggerEvent('updateQuantity', {
        id: item.id,
        quantity: 1
      });
    },

    // 跳转到商品详情页
    goToDetail(e) {
      const { item } = e.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/customer/goods/detail/detail?id=${item.id}`
      });
    },

    // 阻止事件冒泡
    stopPropagation() {
      // 防止点击按钮时触发页面跳转

    }
  }
});