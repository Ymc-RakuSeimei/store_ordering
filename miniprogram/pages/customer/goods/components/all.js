// pages/customer/goods/components/all/all.js
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
      // TODO: 替换为真实接口
      this.setData({
        goodsList: [
          {
            id: '1',
            name: '派大星的扁担',
            price: 99,
            stockText: '库存剩余33件',
            spec: '0.5kg',
            image: '/images/goods_sample.png',
            actionText: '加入购物车',
            actionType: 'addToCart',
            type: 'spot'
          },
          {
            id: '2',
            name: '珊迪氧气罩',
            price: 99,
            stockText: '已预定33件',
            spec: '0.5kg',
            image: '/images/goods_sample.png',
            badge: '接龙预定',
            badgeClass: 'preorder',
            actionText: '参与接龙',
            actionType: 'joinGroup',
            type: 'preorder'
          },
          {
            id: '3',
            name: '珊迪氧气罩',
            price: 84,
            stockText: '库存剩余33件',
            spec: '0.5kg',
            image: '/images/goods_sample.png',
            badge: '特价',
            badgeClass: 'special',
            actionText: '加入购物车',
            actionType: 'addToCart',
            type: 'special'
          }
        ]
      });
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
    }
  }
});