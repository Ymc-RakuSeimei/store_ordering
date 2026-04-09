# 解决 deleteMessage 云函数缺失问题

## 问题诊断

### 错误信息
```
Error Code: -501000 | errMsg: FunctionName parameter could not be found
错误代码: FUNCTION_NOT_FOUND
```

### 根本原因
[message.js](miniprogram/pages/customer/message/message.js#L54-L60) 调用了名为 `deleteMessage` 的云函数，但在 [cloudfunctions](cloudfunctions/) 目录下**不存在**该云函数，导致调用失败。

### 调用位置
**文件**: [message.js:54-60](miniprogram/pages/customer/message/message.js#L54-L60)
```javascript
const deleteRes = await wx.cloud.callFunction({
  name: 'deleteMessage',
  data: {
    type: type,        // 消息类型: 'all' | 'pickup' | 'newgoods'
    openid: openid     // 用户openid
  }
});
```

## 解决方案

创建完整的 `deleteMessage` 云函数，包含以下三个文件：

### 1. 创建云函数主文件
**路径**: `cloudfunctions/deleteMessage/index.js`

**功能实现**:
- 初始化云环境（使用项目统一的环境ID: `cloud1-2gltiqs6a2c5cd76`）
- 接收参数：`type`（消息类型）、`openid`（用户openid）
- 根据 `type` 参数执行不同的删除逻辑：
  - **type='all'**: 删除该用户的所有消息（包括取货提醒和上新通知）
  - **type='pickup'**: 仅删除该用户的取货提醒消息（`openid` 匹配且 `type='pickup'`）
  - **type='newgoods'**: 删除所有上新通知消息（`type='newgoods'`，无openid限制）
- 返回标准格式：`{ code: 0, message: '删除成功', data: { deletedCount } }`

**数据库操作集合**: `messages`

### 2. 创建权限配置文件
**路径**: `cloudfunctions/deleteMessage/config.json`

**权限配置**:
- 数据库权限：`messages` 集合的 `remove` 操作权限

### 3. 创建依赖配置文件
**路径**: `cloudfunctions/deleteMessage/package.json`

**依赖配置**:
- 名称: `deleteMessage`
- 主要依赖: `wx-server-sdk: ~3.0.4`（与项目中其他云函数保持一致）

## 实施步骤

### 步骤 1: 创建目录结构
在 `cloudfunctions/` 下创建 `deleteMessage/` 目录

### 步骤 2: 编写主逻辑文件 (index.js)
参考现有云函数的代码风格（如 [deleteProduct](cloudfunctions/deleteProduct/index.js)、[getMessageList](cloudfunctions/getMessageList/index.js)）：
- 使用 try-catch 错误处理
- 参数验证
- 标准返回格式
- 日志记录

### 步骤 3: 配置权限文件 (config.json)
声明对 `messages` 集合的删除权限

### 步骤 4: 配置依赖文件 (package.json)
使用项目统一的依赖版本

### 步骤 5: 云函数部署（手动）
创建完成后需要在微信开发者工具中：
1. 右键点击 `deleteMessage` 文件夹
2. 选择"上传并部署：云端安装依赖"

## 技术细节

### 消息数据结构（从 getMessageList 分析）
```javascript
{
  _id: String,           // 消息ID
  type: String,          // 消息类型: 'pickup' | 'newgoods'
  title: String,         // 消息标题
  content: String,       // 消息内容
  productId: String,     // 关联商品ID（可选）
  openid: String | null, // 用户openid（取货提醒有值，上新通知为空）
  readUsers: Array,      // 已读用户openid列表
  createdAt: Date,       // 创建时间
  readAt: Date           // 最后读取时间
}
```

### 删除逻辑详解

#### 场景 1: 删除全部消息 (type='all')
```javascript
// 删除条件：用户自己的取货提醒 OR 所有人可见的上新通知
db.collection('messages').where(
  _.or([
    { openid: openid },                    // 用户的取货提醒
    { type: 'newgoods' }                   // 所有上新通知
  ])
).remove()
```

#### 场景 2: 删除取货提醒 (type='pickup')
```javascript
// 删除条件：特定用户的取货提醒
db.collection('messages').where({
  type: 'pickup',
  openid: openid
}).remove()
```

#### 场景 3: 删除上新通知 (type='newgoods')
```javascript
// 删除条件：所有上新通知（不限制用户）
db.collection('messages').where({
  type: 'newgoods'
}).remove()
```

### 注意事项
1. 微信小程序云数据库单次删除上限为 20 条，需要循环批量删除或使用云数据库管理端API
2. 建议添加删除数量统计，便于前端反馈
3. 保持错误处理的一致性，返回 `{ code: -1, message: '错误信息' }` 格式
4. 添加详细日志便于调试

## 预期结果

✅ 创建完成后，[message.js](miniprogram/pages/customer/message/message.js#L34-L86) 的 `deleteAllMessages` 方法将能正常工作
✅ 用户可以成功删除不同类型的消息
✅ 错误码 -501000 将不再出现
