看README！

## 微信开发者工具基本内容

`cloudfunctions` ——云函数
里面每个函数都要单独建立一个文件夹，且文件夹名称必须与函数名一致。
右键 "新建Node.js"
写完云函数一定要"上传并部署：云端安装依赖" 否则用不了，
`cloudfunctions `    右键选上环境

`images/icon/` 里放的是小标识`images/` 里放较大图片（也可以自己建一个文件夹`pages/` 就是小程序的各个页面

`pages/customer/`  顾客端
`pages/merchant/`  商家端
其中的`index`指的是首页
`js`文件是页面逻辑 `wxml`是页面结构 `wxss`是页面样式 `json`是说明
`components`是组件，一般放不怎么动的东西
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

——————————————————————————————————————————————————mc3/23更新：

添加了加载页面（pages/index）和开发身份切换界面（pages/debug/index）

添加了三个云函数

getOpenId 就是获取用户的OpenId

getUserRole获取用户身份——列表DEVELOPER\_OPENIDS是用户白名单，只有里面存的OpenId才有权限在开发者切换界面切换身份，如果数据库没有含该OpenId的元组，则自动生成一个（默认nickName:'微信用户'...，大家pull之后试下，之后在数据库里把自己openId对应的信息换成自己的）

switchRole主要是用于开发身份界面

app.js作了相应适配

pages/index最开始的逻辑是通过系统自带APIwx.getAccountInfoSync()获取当前环境（develop/release/trial），只有非release（正非式发布）时才会有长按切换角色。长按切换的实现：放了一个铺满整个屏幕的透明区域，长按跳转到 pages/debug/index，点击切换身份。其中因为买家端使用了tabBar所以必须用wx.switchTab跳转，这是我卡住的一个点。

添加了miniprogram/node\_modules用于后续生成身份码

——————————————————————————————————————————————————xyz3/24更新：

### 商家端商品管理页面功能升级

- 点击商品弹窗支持修改**进价、售价、库存、商品图片**四项信息
- 新增图片上传功能，自动上传到微信云存储
- 后端`updateProduct`云函数需同步支持`stock`和`img`字段更新

——————————————————————————————————————————————————xyz3/26更新：

- 去掉顶部容器，头像和欢迎语直接在背景里面
- 去掉跳转页面左上角多余的返回按钮
- 订单处理页面新增售后反馈，**注意后端函数需要同步添加反馈内容元素**，同时优化了一下样式和文字
- 预售订货界面美化
- 我的界面点击头像可以上传图片更换头像，**后端函数新增头像字段注意修改**
- 去掉了每个页面多余的返回按钮，仅保留了系统通知的返回按钮

——————————————————————————————————————————————————mc3/28更新：

哈哈哈，核销页面以及身份码来辣！！！

## 首先，咱来康康mc vibe coding了哪些函数

1. <br />

## 再看页面有哪些变化

### 1. waiting（买家端待取货页面）

功能 ：展示用户待取货商品列表 UI交互 ：

- 显示取货码和二维码
- 展示商品列表，区分已到货和待到货状态
- 提供刷新功能
  数据流转 ：

1. 加载数据：获取openid → 获取取货码 → 生成二维码 → 加载待取货订单
2. 页面显示时自动刷新数据，确保获取最新状态
3. 过滤逻辑：只显示未取货的商品（已到货或待到货）
   用户体验改进 ：

- 页面显示时自动刷新，确保数据实时性
- 过滤已取货商品，避免显示无效信息
- 提供取货码复制功能，方便用户使用

### 2. verify（商家端核销页面）

功能 ：商家核销顾客取货 UI交互 ：

- 显示顾客信息和待取货商品列表
- 提供单个商品取货和一键取货功能
- 取货成功后自动刷新数据
  数据流转 ：

1. 加载顾客订单：根据取货码调用getCustomerPendingGoods
2. 执行取货操作：调用pickupGoods云函数
3. 取货成功后刷新数据，更新页面显示
   用户体验改进 ：

- 取货操作后自动刷新，确保页面显示最新状态
- 提供确认对话框，避免误操作
- 显示处理状态，提升操作反馈

### 3. order（商家端订单页面）

功能 ：管理各类订单，提供取货码验证入口 UI交互 ：

- 标签页切换：待取货、待到货、顾客订单、售后反馈
- 取货码输入和验证
- 扫码取货功能
  数据流转 ：

1. 加载所有订单数据
2. 验证取货码并跳转到核销页面
3. 扫码取货直接跳转到核销页面
   用户体验改进 ：

- 提供多种取货码输入方式（手动输入和扫码）
- 实时验证取货码格式，提升输入体验
- 快速跳转到核销页面，简化操作流程

## 函数与页面d调用关系

### 1. 取货码获取流程

- 买家端 ：waiting页面 → getOpenId云函数 → getPickupCode云函数 → 生成二维码
- 商家端 ：order页面 → 手动输入/扫码 → verify页面

### 2. 核销取货流程

- 商家端 ：verify页面 → getCustomerPendingGoods云函数 → 显示商品列表 → pickupGoods云函数 → 刷新页面
- 买家端 ：waiting页面 → getOrderList云函数 → 过滤未取货商品 → 显示待取货列表

### 3. 数据同步机制

- 实时性 ：买家端页面显示时自动刷新，商家端核销后立即刷新
- 一致性 ：通过云函数直接操作数据库，确保数据一致性
- 可靠性 ：批量处理和错误处理机制，确保操作可靠性

## 流程

1. 用户下单 ：生成订单，状态为"待取货"
2. 商家确认 ：商品状态更新为"已到货"
3. 顾客取货 ：
   - 顾客获取取货码（waiting页面）
   - 商家通过取货码或扫码进入核销页面（order页面）
   - 商家核销商品（verify页面）
   - 系统更新商品状态为"已取货"
   - 买家端自动移除已取货商品（waiting页面）

## 注意

1. getCustomerPendingGoods中有个'/images/goods\_sample.png' 我没加这个图，这主要是用于商品没有对应的图片的时候(数据库images为空)贴图
2. orders里的第二条记录是我用于测试的，用的我本地的openid以及用它生成的pickupCode，你们本地要是想测试自己添加格式相同的(技巧：把数据库集合导出为json，复制一行再导入)，但是openid用自己的
3. 然后我现在没有写同步相关的代码（就是把users对应的nickname、phoneNumber和orders里customerInfo的信息同步），这个交给买家端写生成订单的同学
4. 大家理解一下orders记录中status和goods里的pickupStatus字段的区别
5. 大家理解一下orders，它是啥意思呢？就是每一次购物车的合并结算都应该对应着一个orders记录，比如Ymc，在不同的时间段在小程序里买了3次东西，那么orders里就应该有 3条记录 里面的openid pickupCode customerInfo都一样，都是Ymc的。待取货的订单列表里我写的是根据数据库相应pickupCode/openid找对应goods信息并合并(AI建议后续加索引？我有空研究下)，所以不同担心合并问题了

——————————————————————————————————————————————————2026/3/29 YJ商品管理联调更新：

### 本版本新增功能

- 商家端 `pages/merchant/product/product` 已接入真实云开发数据，不再使用本地 mock 商品列表
- 商品管理页已支持完整的商品加载、添加、编辑流程
- 新增商品支持上传图片到微信云存储
- 编辑商品支持修改售价、进价、库存、商品图片，并同步更新云数据库
- 商品管理相关接口已增加商家身份校验，只有 `users.role === 'merchant'` 的用户可以操作

### 新增云函数

- `fetchGoods`：拉取商品管理页数据，返回格式统一为 `{ code, message, data }`
- `addProduct`：新增商品
- `updateProduct`：更新商品

### 商品管理页当前约定

- 商品管理页只展示两类商品：`现货` 和 `特价处理`
- `preorder / 预定` 类型商品不会进入商品管理页列表
- 商品页底部 tab 已统一为：`首页 / 商品 / 我的`
- 商品页左上角返回按钮已移除，目前仅保留系统通知页的返回按钮

### 与当前云数据库的字段对齐说明

- 真实 `goods` 集合当前主要字段是：`specs / price / cost / images / type`
- 前端商品管理页内部统一使用：`spec / sellPrice / costPrice / img / special`
- 当前做法是：**云函数兼容真实数据库字段，再返回给前端统一结构**
- 也就是说，现阶段不需要先手动迁移 `goods` 集合，代码已经做了兼容，就是前端依旧按照以往的风格编写就可以，我已经在后端做好了接口。

### 权限与身份说明

- 新用户默认会注册为 `customer`
- 商品管理相关云函数会读取 `users` 集合并校验 `role`
- 若当前账号不是 `merchant`，商品列表加载、新增、编辑都会被拒绝

### 协作开发注意事项

- 本次联调时使用了项目根目录下的 `db-export/` 作为云数据库导出快照，仅用于本地对齐字段，不会自动同步到云端
- 若继续改动 `fetchGoods / addProduct / updateProduct` 这三个云函数，部署时建议使用“上传并部署：云端安装依赖”
- 第一次部署新云函数时，必须执行一次“上传并部署：云端安装依赖”
- `goods` 集合里如果存在测试占位数据（例如无效图片、占位 type），页面会尽量兜底显示默认图，但建议后续逐步清理数据
- 如果后续要做顾客端商品页，建议继续沿用“云函数做字段兼容，前端使用统一字段”的方式，避免前后端字段再次分叉

——————————————————————————————————————————————————2026/3/29 xyz接龙

- 商品管理的图片展示优化了一下

# 接龙分享功能对接文档

## 一、新增文件

### 前端页面

- `miniprogram/pages/preorder/join/` - 独立的接龙参与页面

### 云函数

- `cloudfunctions/fetchPreorderDetail/` - 获取接龙详情
- `cloudfunctions/submitPreorder/` - 提交接龙参与

### 修改文件

- `app.json` - 添加新页面路由
- `merchant/preorder/detail/detail.js/wxml` - 添加转发功能

***

## 二、数据库设计

### preorder\_dragons（接龙活动表）

| 字段            | 类型     | 必填 | 说明                    |
| ------------- | ------ | -- | --------------------- |
| `_id`         | String | 是  | 接龙ID                  |
| `name`        | String | 是  | 商品名称                  |
| `img`         | String | 否  | 商品图片                  |
| `spec`        | String | 否  | 规格                    |
| `salePrice`   | Number | 是  | 售价                    |
| `costPrice`   | Number | 否  | 成本价                   |
| `arrivalDate` | String | 否  | 预计到货日期                |
| `status`      | String | 是  | `ongoing`/`completed` |
| `merchantId`  | String | 是  | 商家ID                  |
| `createTime`  | Date   | 是  | 创建时间                  |

### preorder\_participants（接龙参与记录表）

| 字段           | 类型     | 必填 | 说明       |
| ------------ | ------ | -- | -------- |
| `_id`        | String | 是  | 记录ID     |
| `dragonId`   | String | 是  | 接龙ID     |
| `userId`     | String | 是  | 用户openid |
| `userName`   | String | 否  | 用户昵称     |
| `avatarUrl`  | String | 否  | 用户头像     |
| `qty`        | Number | 是  | 数量       |
| `remark`     | String | 否  | 备注       |
| `joinTime`   | Date   | 是  | 参与时间     |
| `createTime` | Date   | 是  | 创建时间     |

***

## 三、云函数接口

### 1. fetchPreorderDetail - 获取接龙详情

### 2. submitPreorder - 提交接龙参与

**错误码：** `-1` - 参数错误/接龙不存在/已结束/已参与/用户不存在

**实现逻辑：**

1. 开启事务
2. 校验接龙状态
3. 检查重复参与
4. 获取用户信息
5. 插入参与记录
6. 提交事务

***

## 四、功能流程

### 商家端转发

1. 商家在接龙详情页点击「转发接龙」
2. 分享卡片路径：`/pages/preorder/join/join?id={dragonId}`

### 顾客端参与

1. 点击卡片进入 `pages/preorder/join/join`
2. 调用 `app.getUserRole()` 验证身份（自动注册新用户）
3. 调用 `fetchPreorderDetail` 获取详情
4. 填写数量和备注，提交到 `submitPreorder`
5. 成功后显示已参与状态

***

## 五、后端待办

| 序号 | 工作项                                                |
| -- | -------------------------------------------------- |
| 1  | 创建 `preorder_dragons` 和 `preorder_participants` 集合 |
| 2  | 部署 `fetchPreorderDetail` 和 `submitPreorder` 云函数    |
| 3  | 对接商家创建接龙接口（写入 `preorder_dragons`）                  |
| 4  | 对接截止接龙接口（更新 `status` 为 `completed`）                |
| 5  | 实现导出表格功能                                           |

***

## 六、注意事项

- 同一用户对同一接龙只能参与一次
- `submitPreorder` 使用事务保证数据一致性
- 时间格式返回 `YYYY-MM-DD HH:mm`

***

——————————————————————————————————————————————————2026/3/30 ls更新

## 2026/3/30 买家端myOrder页面更新

### 功能完善

- 完善了买家端myOrder页面逻辑，使其能够从数据库中读取对应用户的订单情况
- 统一了三个页面（全部、待取货、已完成）的订单卡片样式和尺寸

### UI显示优化

- 统一了订单卡片的大小，以全部页面为参照标准
- 优化了状态按钮的样式和颜色：
  - 待取货状态：黄色背景，黑色文字
  - 待到货状态：灰色背景，灰色文字
  - 已完成状态：绿色背景，绿色文字

### 数据处理改进

- 优化了订单数据的过滤逻辑，确保正确显示不同状态的订单
- 修复了已完成页面的数据显示问题，确保只显示已完成的订单

### 样式统一

- 统一了三个页面的订单卡片样式，包括：
  - 卡片宽度：100%
  - 内边距：28rpx 24rpx
  - 边框圆角：12px
  - 商品图片尺寸：140rpx × 140rpx
  - 布局结构：flex布局，包含序号、图片、信息和状态区域
  - 间距：卡片间距24rpx，内部元素间距28rpx

——————————————————————————————————————————————————2026/3/31 xyz更新

1. sendPickupReminder - 发送取货提醒
   文件位置： cloudfunctions/sendPickupReminder/
   功能：
   查询 orders 表，找到包含指定商品且 pickupStatus === '待取货' 的订单
   提取顾客 openid（去重）
   为每个顾客在 messages 表插入一条消息记录
2. fetchGoodsList - 获取商品列表
   文件位置： cloudfunctions/fetchGoodsList/
   功能：
   查询 goods 表所有商品
   供消息中心页面生成库存提醒和滞留预警

- 滞留：条件： status === '已到货' 且 arrivedAt 距今 ≥ 2 天
- 不足：条件： totalBooked >= stock \* 0.7	已卖出的达到库存的 70% 以上
  ——————————————————————————————————————————————————2026/3/31 YJ
——————————————————————————————————————————————————2026/3/31 xyz更新
1. sendPickupReminder - 发送取货提醒
文件位置： cloudfunctions/sendPickupReminder/
功能：
查询 orders 表，找到包含指定商品且 pickupStatus === '待取货' 的订单
提取顾客 openid（去重）
为每个顾客在 messages 表插入一条消息记录
2. fetchGoodsList - 获取商品列表
文件位置： cloudfunctions/fetchGoodsList/
功能：
查询 goods 表所有商品
供消息中心页面生成库存提醒和滞留预警
- 滞留：条件： status === '已到货' 且 arrivedAt 距今 ≥ 2 天
- 不足：条件： totalBooked >= stock * 0.7	已卖出的达到库存的 70% 以上
——————————————————————————————————————————————————2026/3/31 YJ

## 1. 功能添加

- 商品管理页“修改商品信息”弹窗改为竖排三按钮：`确认修改 / 删除商品 / 取消`
- 新增商品删除能力：商家端可直接在商品管理页删除商品
- 买家下单后，`goods` 集合中的库存会同步扣减；库存不足时会阻止下单
- 新增商品业务唯一标识 `goodsId`，后续订单中的 `orders.goods.goodsId` 优先使用该字段
- 顾客端商品列表、购物车、下单链路已兼容 `goodsId`；老数据仍可回退使用 `_id`

## 2. 改动文件及模块

- `miniprogram/pages/merchant/product/product.wxml`
  - 修改商品弹窗底部操作区改为竖排三按钮
  - 删除商品按钮由占位交互改为真实删除事件
- `miniprogram/pages/merchant/product/product.wxss`
  - 新增编辑弹窗操作按钮栈样式
  - 拆分确认按钮 / 删除按钮 / 取消按钮的视觉样式
- `miniprogram/pages/merchant/product/product.js`
  - 新增删除商品前端流程：确认弹窗、调用云函数、删除成功后同步刷新本地列表
- `cloudfunctions/deleteProduct/index.js`
  - 新增删除商品云函数
  - 增加商家身份校验和 `goods` 集合删除逻辑
- `cloudfunctions/deleteProduct/config.json`
  - 新增删除商品所需数据库权限配置
- `cloudfunctions/deleteProduct/package.json`
  - 新增删除商品云函数依赖声明
- `cloudfunctions/createOrder/index.js`
  - 下单时增加库存扣减逻辑
  - 使用事务保证“扣库存 + 创建订单”一致性
  - 增加按 `goodsId` 查询商品，并兼容旧 `_id` 的回退逻辑

- `cloudfunctions/createOrder/config.json`
  - 补充 `users / goods / orders` 相关读写权限

- `cloudfunctions/addProduct/index.js`
  - 新增商品成功后自动生成并回写 `goodsId`

- `miniprogram/pages/customer/goods/components/all.js`
- `miniprogram/pages/customer/goods/components/spot.js`
- `miniprogram/pages/customer/goods/components/special.js`
- `miniprogram/pages/customer/goods/components/preorder.js`
- `miniprogram/pages/customer/goods/newgoods/newgoods.js`
  - 顾客端商品卡片展示与购物车入参改为优先使用 `goodsId`
  - 老数据没有 `goodsId` 时，继续兼容回退 `_id`

——————————————————————————————————————————————————2026/4/1 ls售后/联系商家页面更新

## 1. 功能概述

完善了买家端"我的"页面的售后/联系商家功能，包含两个主要模块：

- **联系商家**：获取商家微信号并支持复制
- **售后申请**：根据商品状态提供不同的售后选项
- **意见反馈**：订单评价和反馈功能

## 2. 新增页面

- `miniprogram/pages/customer/feedback/feedback.wxml/wxss/js/json` - 售后反馈页面

## 3. 云函数改动

### getUserInfo（修改）

- 支持根据店名查询商家信息（在Ls的订单里添加了store字段，Ymc的用户添加了storeName字段，目前实现的根据当前用户订单的店名查询微信号）

### submitFeedback（修改）

- 支持售后申请提交（覆盖更新机制，同一订单同一商品第二次提交售后申请会自动覆盖上一次）
- 支持意见反馈提交（同一订单只能提交一次，不能重复提交反馈）

## 4. 数据库字段更新

### users集合

- 新增 `wechat` 字段：商家微信号
- 新增 `storeName` 字段：店铺名称

### feedbacks集合

存储售后申请和意见反馈数据

| 字段              | 类型     | 必填 | 说明                                            |
| --------------- | ------ | -- | --------------------------------------------- |
| `_id`           | String | 是  | 记录唯一标识                                        |
| `openid`        | String | 是  | 用户openid                                      |
| `type`          | String | 是  | 反馈类型：'售后申请' / '意见反馈'                          |
| `orderId`       | String | 是  | 订单ID                                          |
| `orderNo`       | String | 是  | 订单编号                                          |
| `goodsId`       | String | 否  | 商品ID（售后申请必填）                                  |
| `goodsName`     | String | 否  | 商品名称（售后申请必填）                                  |
| `afterSaleType` | String | 否  | 售后类型：'取消订单' / '仅退款' / '退货退款' / '更换货品'（售后申请必填） |
| `reason`        | String | 否  | 售后理由（售后申请必填）                                  |
| `content`       | String | 否  | 反馈内容（意见反馈必填）                                  |
| `rating`        | Number | 否  | 评分 0-5（意见反馈必填）                                |
| `images`        | Array  | 否  | 图片URL数组                                       |
| `status`        | String | 是  | 处理状态：'待处理' / '处理中' / '已完成'                    |
| `createdAt`     | Date   | 是  | 创建时间                                          |
| `updatedAt`     | Date   | 是  | 更新时间                                          |

## 5. 售后申请功能详情

### 流程

1. 选择订单 → 选择商品 → 选择售后类型 → 填写理由 → 上传图片 → 提交

### 售后类型（根据商品pickupStatus动态生成）

- **未到货**：仅可选择"取消订单"
- **待取货**：可选择"仅退款"、"更换货品"
- **已完成**：可选择"仅退款"、"退货退款"、"更换货品"

### 提交验证

- 必须选择订单和商品
- 必须选择售后类型
- 必须填写售后理由
- 必须上传售后图片

### 覆盖更新机制

- 同一用户、同一订单、同一商品的售后申请会覆盖更新
- 保留首次创建时间，更新修改时间

## 6. 意见反馈功能详情

### 流程

1. 选择订单 → 查看订单详情 → 评分 → 填写内容 → 上传图片 → 提交

### 功能特性

- 五星评分系统（暂不支持半星）
- 订单详情展示（商品列表）
- 防止同一订单重复提交反馈
- 已提交反馈的订单显示提示信息

## 7. 联系商家功能详情

### 流程

1. 获取用户订单列表
2. 提取订单对应的店名
3. 根据店名查询商家信息
4. 显示商家微信号并提供复制功能

## 8. UI/UX优化

### 样式统一

- 统一字体大小和颜色
- 统一选择器样式（高度、圆角、背景色）
- 统一按钮样式（蓝色背景、圆角、文字居中）
- 统一placeholder颜色（灰色）

### 交互优化

- 选择商品后才显示后续表单项
- 选择订单和商品后才显示提交按钮
- 实时验证和提示
- 加载状态优化

## 9. 文件修改清单

### 前端文件

- `miniprogram/pages/customer/my/my.js` - 添加联系商家逻辑
- `miniprogram/pages/customer/feedback/feedback.wxml/wxss/js/json` - 新增售后反馈页面

### 云函数

- `cloudfunctions/getUserInfo/index.js` - 添加商家查询逻辑
- `cloudfunctions/submitFeedback/index.js` - 添加售后和反馈提交逻辑

### 样式文件

- `miniprogram/pages/customer/feedback/feedback.wxss` - 完整的页面样式

## 10. 注意事项

1. **重新上传云函数**：修改后的`getUserInfo`和`submitFeedback`需要重新上传部署
2. **商家信息**：确保商家用户在users集合中有wechat和storeName字段
3. **订单数据**：确保orders集合中有store字段用于匹配商家


