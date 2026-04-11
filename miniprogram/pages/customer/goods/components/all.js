// pages/customer/goods/components/all/all.js
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
    formatGoodsItem(item) {
      const isPreorder = item.type === 'preorder';
      const isSpot = item.type === 'spot' || item.type === 'special';
      const isSpecial = item.type === 'special';
      
      let imageUrl = '';
      if (item.images && item.images.length > 0 && item.images[0]) {
        imageUrl = item.images[0];
      }
      if (imageUrl && (imageUrl === '图一' || imageUrl === '图二')) {
        imageUrl = '';
      }
      
      const cartQuantity = item.cartQuantity || 0;
      
      return {
        id: item.goodsId || item._id,
        name: item.name || '商品名称',
        price: isSpecial ? (item.specialPrice || item.price) : item.price,
        originalPrice: isSpecial ? item.price : null,
        statusText: isPreorder 
          ? `已预定${item.totalBooked || 0}件` 
          : `库存剩余${item.stock || 0}件`,
        spec: item.specs || '无规格',
        image: imageUrl,
        badgeText: isPreorder ? '接龙预定' : (isSpot ? '现货订购' : ''),
        badgeClass: isPreorder ? 'preorder' : (isSpot ? 'spot' : ''),
        priceClass: isSpecial ? 'special-price' : '',
        actionText: isPreorder ? '参与接龙' : '加入购物车',
        actionType: isPreorder ? 'joinGroup' : 'addToCart',
        type: item.type,
        cartQuantity: cartQuantity,
        limitPerPerson: item.limitPerPerson || 0  // 添加限购字段
      };
    },

    filterGoods() {
      let list = [...this.data.originalList];
      list = list.map(item => this.formatGoodsItem(item));
      
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
      if (item.actionType === 'addToCart') {
        this.triggerEvent('addToCart', {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          type: item.type
        });
      } else if (item.actionType === 'joinGroup') {
        this.triggerEvent('joinGroup', {
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image
        });
      }
    },

    decreaseQuantity(e) {
      const { item } = e.currentTarget.dataset;
      this.triggerEvent('updateQuantity', {
        id: item.id,
        quantity: -1
      });
    },

    // 增加数量（增加限购检查）
    increaseQuantity(e) {
      const { item } = e.currentTarget.dataset;
      // 接龙商品检查限购
      if (item.type === 'preorder' && item.limitPerPerson > 0) {
        const currentQty = item.cartQuantity || 0;
        if (currentQty >= item.limitPerPerson) {
          wx.showToast({ title: `每人限购${item.limitPerPerson}件`, icon: 'none' });
          return;
        }
      }
      this.triggerEvent('updateQuantity', {
        id: item.id,
        quantity: 1
      });
    },

    goToDetail(e) {
      const { item } = e.currentTarget.dataset;
      if (item.type === 'preorder') {
        wx.navigateTo({
          url: `/pages/preorder/join/join?id=${item.id}`
        });
      } else {
        wx.navigateTo({
          url: `/pages/customer/goods/detail/detail?id=${item.id}`
        });
      }
    },

    stopPropagation() {}
  }
});