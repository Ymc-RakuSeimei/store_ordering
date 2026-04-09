// components/loading/loading.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    text: {
      type: String,
      value: ''
    },
    size: {
      type: String,
      value: 'medium',
      validator: function(value) {
        return ['small', 'medium', 'large'].indexOf(value) !== -1;
      }
    },
    type: {
      type: String,
      value: 'primary',
      validator: function(value) {
        return ['default', 'primary', 'success', 'warning', 'error'].indexOf(value) !== -1;
      }
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    animation: null
  },

  /**
   * 组件的方法列表
   */
  methods: {
    startAnimation: function() {
      const animation = wx.createAnimation({
        duration: 1000,
        timingFunction: 'linear',
        repeat: -1
      });
      animation.rotate(360).step();
      this.setData({
        animation: animation.export()
      });
    }
  },

  /**
   * 生命周期函数
   */
  attached: function() {
    this.startAnimation();
  }
})