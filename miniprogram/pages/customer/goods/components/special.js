// pages/customer/goods/components/special/special.js
Component({
  data: {
    goodsList: []
  },

  lifetimes: {
    attached() {
      this.loadGoods();
    }
  },

  methods: {
    loadGoods() {
      // TODO: 替换为真实接口 - 只获取特价商品
      this.setData({
        goodsList: [
          {
            id: '3',
            name: '珊迪氧气罩',
            specialPrice: 84,
            originalPrice: 99,
            stock: 33,
            spec: '0.5kg',
            image: '/images/goods_sample.png'
          },
          {
            id: '6',
            name: '派大星渔网',
            specialPrice: 59,
            originalPrice: 89,
            stock: 20,
            spec: '0.8kg',
            image: '/images/goods_sample.png'
          }
        ]
      });
    },

    onAddToCart(e) {
      const { item } = e.currentTarget.dataset;
      this.triggerEvent('addToCart', {
        id: item.id,
        name: item.name,
        price: item.specialPrice,
        image: item.image,
        type: 'special'
      });
    }
  }
});