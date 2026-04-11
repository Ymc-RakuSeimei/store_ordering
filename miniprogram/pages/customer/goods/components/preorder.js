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
    formatGoodsItem(item) {
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
        cartQuantity: cartQuantity,
        limitPerPerson: item.limitPerPerson || 0
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
      if (item.actionType === 'joinGroup') {
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
      if (item.limitPerPerson > 0) {
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
      wx.navigateTo({
        url: `/pages/preorder/join/join?id=${item.id}`
      });
    },

    stopPropagation() {}
  }
});