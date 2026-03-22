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

---

## merchant 商家端需完成的后端接口函数清单

以下为商家端各页面所需的后端云函数，按页面分类整理。目前前端均以 Promise.resolve() 占位，需在 cloudfunctions 中实现对应云函数并「上传并部署：云端安装依赖」。

### 一、数据中心 (datacenter)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 1 | getDataCenterStats | 获取营收统计（本月总收入/总成本/净利润） | `{ period?: 'month' \| 'week' \| 'day' }` | `{ totalRevenue, totalCost, netProfit }` |
| 2 | getOrderStatusCounts | 获取订单状态统计（已到货、已取货、待取货） | 无 | `{ delivered, pickedUp, pendingPickup }` |
| 3 | pushOrderReminder | 一键提醒待取货客户 | 无 | 无 |

### 二、系统通知 (notification)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 4 | fetchNotifications | 获取通知列表 | 无 | `[{ id, type, title?, text, subText?, showRemindAction }]` |
| 5 | deleteAllNotifications | 删除所有通知 | 无 | 无 |
| 6 | remindNotification | 发送单条通知提醒 | `{ id }` | 无 |

### 三、订单处理 (order)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 7 | fetchOrderList | 按状态获取订单列表 | `{ status: '待取货' \| '待到货' \| '顾客订单' }` | `[{ _id, name, qty, left?, spec }]` |
| 8 | pushOrderReminder | 提醒全部待取货订单 | 无 | 无 |

### 四、订单详情 (order/detail)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 9 | fetchOrderDetail | 获取订单详情 | `{ orderId }` | `{ _id, customerName, phone, pendingPickup, pendingArrival }` |
| 10 | updateOrderItemStatus | 更新订单商品取货状态 | `{ orderId, itemId?, status: 'picked', all?: true }` | 无 |

### 五、预售订货 (preorder)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 11 | getPreorderList | 获取预售接龙列表 | 无 | `{ current: [], completed: [] }` |
| 12 | getPreorderStats | 一键统计预售数据 | 无 | 无 |
| 13 | statSinglePreorder | 统计单个接龙 | `{ id }` | 无 |
| 14 | stopPreorder | 截止单个接龙 | `{ id }` | 无 |

### 六、创建接龙 (preorder/create)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 15 | createPreorderDragon | 创建接龙并返回分享数据 | `{ name, description, spec, salePrice, costPrice, closeType }` | 分享链接或卡片数据 |

### 七、商品管理 (product)

| 序号 | 云函数名 | 说明 | 入参 | 返回结构 |
|-----|----------|------|------|----------|
| 16 | fetchGoods | 获取商品列表（现货/特价） | 无 | `{ stock: [], special: [] }` |
| 17 | addProduct | 新增商品 | `{ name, spec, sellPrice, costPrice, stock, special, img }` | `{ _id }` |
| 18 | updateProduct | 更新商品 | `{ id, sellPrice, costPrice }` | 无 |

---

**汇总：共 18 个后端接口函数**（pushOrderReminder 在 datacenter 与 order 中复用）