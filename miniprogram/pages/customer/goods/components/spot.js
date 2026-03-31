// pages/customer/goods/components/spot/spot.js
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
      
      return {
        // 优先使用 goodsId 作为业务索引；老数据没有 goodsId 时回退到 _id。
        id: item.goodsId || item._id,
        name: item.name || '商品名称',
        price: item.price || 0,
        originalPrice: null,
        statusText: `库存剩余${item.stock || 0}件`,
        spec: item.specs || '无规格',
        image: imageUrl,
        badgeText: '',
        badgeClass: '',
        priceClass: '',
        actionText: '加入购物车',
        actionType: 'addToCart',
        type: item.type
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

    onAddToCart(e) {
      const { item } = e.currentTarget.dataset;
      this.triggerEvent('addToCart', {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        type: item.type
      });
    }
  }
});
