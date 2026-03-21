测试——ymc

## 微信开发者工具基本内容

cloudfunctions ——云函数
  里面每个函数都要单独建立一个文件夹，且文件夹名称必须与函数名一致
  右键 "新建Node.js"
  写完云函数一定要"上传并部署：云端安装依赖" 否则用不了
cloudfunctions 右键选上环境 
images/icon  里放的是小标识
images/  里放较大图片（也可以自己建一个文件夹
pages/  就是小程序的各个页面 
pages/customer/  顾客端
pages/merchant/  商家端
其中的index指的是首页
js文件是页面逻辑 wxml是页面结构 wxss是页面样式 json是说明
components是组件，一般放不怎么动的东西
编译模式 可以在开发时切换不同页面，而具体页面内换页按钮需代码（问AI）
右上角-云开发:数据库、存储、云函数
//x测试测试

2026/3/12
./datacenter数据中心页面
./index主页（无调用函数）
./notification系统消息中心
./order订单页面
./order/detail每个订单点进去都有的详情页面
./preorder预售页面
./preorder/create创建接龙页面
./product商品页面

1.每个页面调用用到的函数都在每个页面的.js文件最后面，可根据注释或者在云开发里面直接打开到那个页面看看需要填写什么数据来构建数据库和写函数
2.关于切换到商家端和顾客端的切换，由于好像并没有做，所以现在可以在app.json文件里面吧pages里面的"pages/customer/index/index",等一系列数据提前到merchant页面前面就可以显示顾客端了