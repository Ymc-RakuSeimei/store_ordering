// pages/customer/goods/components/spot/spot.js
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
      // TODO: 替换为真实接口 - 只获取现货商品
      this.setData({
        goodsList: [
          {
            id: '1',
            name: '派大星的扁担',
            price: 99,
            stock: 33,
            spec: '0.5kg',
            image: '/images/goods_sample.png'
          },
          {
            id: '3',
            name: '海绵宝宝捕鱼网',
            price: 129,
            stock: 15,
            spec: '1.0kg',
            image: '/images/goods_sample.png'
          },
          {
            id: '4',
            name: '章鱼哥的笛子',
            price: 199,
            stock: 8,
            spec: '木质',
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
        price: item.price,
        image: item.image,
        type: 'spot'
      });
    }
  }
});