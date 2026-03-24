// pages/customer/goods/components/preorder/preorder.js
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
      // TODO: 替换为真实接口 - 只获取预定商品
      this.setData({
        goodsList: [
          {
            id: '2',
            name: '珊迪氧气罩',
            price: 99,
            preordered: 33,
            spec: '0.5kg',
            image: '/images/goods_sample.png'
          },
          {
            id: '5',
            name: '蟹堡王秘方',
            price: 299,
            preordered: 56,
            spec: '限量版',
            image: '/images/goods_sample.png'
          }
        ]
      });
    },

    onJoinGroup(e) {
      const { item } = e.currentTarget.dataset;
      this.triggerEvent('joinGroup', {
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image
      });
    }
  }
});