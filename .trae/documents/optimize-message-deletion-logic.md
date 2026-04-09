# 优化消息删除逻辑：区分物理删除与软删除

## 需求分析

### 当前问题
1. **上新通知（newgoods）**：所有用户共享的消息，当前实现会直接从数据库删除记录，影响其他用户
2. **取货提醒（pickup）**：用户个人消息，应该真正删除数据库记录 ✅ 正确
3. **全部删除（all）**：需要分别处理两种类型

### 目标行为
| 消息类型 | 删除方式 | 影响范围 |
|---------|---------|---------|
| **pickup（取货提醒）** | 物理删除（`.remove()`） | 仅影响当前用户 |
| **newgoods（上新通知）** | 软删除（标记隐藏） | 仅对当前用户隐藏，不影响其他用户 |
| **all（全部）** | 混合处理 | pickup 物理删除 + newgoods 软删除 |

## 技术方案

### 核心思路
引入 **软删除机制**：
- 新增字段 `deletedUsers: []` 记录已"删除"该消息的用户列表
- 上新通知删除时：将用户 openid 添加到 `deletedUsers`
- 查询时过滤：排除当前用户在 `deletedUsers` 中的记录

### 数据模型变更

#### messages 集合字段说明
```javascript
{
  _id: String,              // 消息ID
  type: String,             // 'pickup' | 'newgoods'
  title: String,            // 消息标题
  content: String,          // 消息内容
  productId: String,        // 关联商品ID
  openid: String | null,    // 用户openid（pickup有值，newgoods为null）
  readUsers: Array,         // 已读用户列表
  deletedUsers: Array,      // 【新增】已删除/隐藏的用户列表
  createdAt: Date,
  readAt: Date
}
```

## 实施步骤

### 步骤 1：修改 createMessage 云函数
**文件**: [cloudfunctions/createMessage/index.js](cloudfunctions/createMessage/index.js)

**修改内容**:
- 在创建消息时初始化 `deletedUsers: []` 字段
- 确保新创建的消息都包含此字段

**具体改动**:
```javascript
// 第26-33行，messageData 对象中新增字段
const messageData = {
  type: type,
  title: title || '',
  content: content,
  productId: productId || '',
  readUsers: [],
  deletedUsers: [],  // 【新增】初始化已删除用户列表
  createdAt: new Date()
};
```

### 步骤 2：重构 deleteMessage 云函数
**文件**: [cloudfunctions/deleteMessage/index.js](cloudfunctions/deleteMessage/index.js)

**核心逻辑重构**:

#### 2.1 删除策略配置
```javascript
function buildDeleteStrategy(type, openid) {
  switch (type) {
    case 'all':
      return [
        { action: 'remove', condition: { type: 'pickup', openid } },
        { action: 'softDelete', condition: { type: 'newgoods' }, description: '取货提醒+上新通知' }
      ];

    case 'pickup':
      return [{ action: 'remove', condition: { type: 'pickup', openid }, description: '取货提醒' }];

    case 'newgoods':
      return [{ action: 'softDelete', condition: { type: 'newgoods' }, description: '上新通知' }];

    default:
      throw new Error(`不支持的消息类型: ${type}`);
  }
}
```

#### 2.2 执行器实现
```javascript
async function executeDelete(strategy, openid) {
  let totalAffected = 0;

  for (const item of strategy) {
    if (item.action === 'remove') {
      // 物理删除：用于 pickup 类型
      const result = await db.collection('messages')
        .where(item.condition)
        .remove();
      totalAffected += result.stats?.removed || 0;
    }

    if (item.action === 'softDelete') {
      // 软删除：将用户添加到 deletedUsers
      const result = await db.collection('messages')
        .where(item.condition)
        .update({
          data: {
            deletedUsers: _.addToSet(openid)
          }
        });
      totalAffected += result.stats?.updated || 0;
    }
  }

  return totalAffected;
}
```

#### 2.3 返回值调整
```javascript
return {
  code: 0,
  message: '操作成功',
  data: {
    affectedCount: totalAffected,  // 统一用 affectedCount 表示影响数量
    type: type,
    detail: {                     // 【新增】详细统计
      removed: removedCount,       // 物理删除数量
      softDeleted: softDeletedCount // 软删除数量
    }
  }
};
```

### 步骤 3：修改 getMessageList 查询逻辑
**文件**: [cloudfunctions/getMessageList/index.js](cloudfunctions/getMessageList/index.js)

**关键修改点**:

#### 3.1 过滤已删除的上新通知
在查询条件中添加过滤：

**场景 A：查询所有消息（type 为空）**
```javascript
// 当获取所有消息时，返回：
// 1. 用户的取货提醒（未删除）
// 2. 未被当前用户删除的上新通知
query = query.where(
  _.or([
    {                          // 条件1: 用户的取货提醒
      openid: openid,
      deletedUsers: _.neq([openid])  // 或 deletedUsers 不包含 openid
    },
    {                          // 条件2: 上新通知（未被当前用户删除）
      type: 'newgoods',
      deletedUsers: _.nin([openid])  // nin = not in
    }
  ])
);
```

**场景 B：仅查询 newgoods 类型**
```javascript
if (type === 'newgoods') {
  // 过滤掉当前用户已删除的记录
  filter.deletedUsers = _.nin([openid]);
}
```

**场景 C：查询 pickup 类型**
```javascript
if (type === 'pickup') && openid) {
  filter.openid = openid;
  // pickup 是物理删除，不需要额外过滤
}
```

#### 3.2 处理返回数据
保持现有的 `isRead` 处理逻辑不变。

### 步骤 4：兼容性处理（重要）

#### 4.1 历史数据兼容
对于已经存在的、没有 `deletedUsers` 字段的老数据：
- 使用 `_.exists(false)` 或默认值处理
- 查询时：`deletedUsers` 不存在 或 不包含当前用户 = 显示

```javascript
// 安全的过滤条件（兼容老数据）
const notDeletedByUser = _.or([
  { deletedUsers: _.nin([openid]) },           // 有字段但不含当前用户
  { deletedUsers: _.exists(false) }            // 无该字段（老数据）
]);
```

#### 4.2 前端兼容性
**不修改前端代码**，因为：
- 前端调用接口参数不变（`type`, `openid`）
- 返回值格式保持 `{ code, message, data }` 结构
- 仅内部实现细节变化

## 文件修改清单

| 序号 | 文件路径 | 修改类型 | 修改内容 |
|-----|---------|---------|---------|
| 1 | [createMessage/index.js](cloudfunctions/createMessage/index.js) | 小改 | 添加 `deletedUsers: []` 初始化 |
| 2 | [deleteMessage/index.js](cloudfunctions/deleteMessage/index.js) | 重构 | 区分物理删除和软删除逻辑 |
| 3 | [getMessageList/index.js](cloudfunctions/getMessageList/index.js) | 中改 | 添加 deletedUsers 过滤条件 |

## 测试验证要点

### 功能测试
1. ✅ 删除取货提醒 → 数据库记录消失
2. ✅ 删除上新通知 → 仅对当前用户隐藏，其他用户仍可见
3. ✅ 删除全部消息 → pickup 真删除 + newgoods 隐藏
4. ✅ 创建新消息 → 包含 deletedUsers 字段
5. ✅ 查询消息列表 → 已删除的不显示

### 兼容性测试
1. ✅ 老数据（无 deletedUsers 字段）正常显示
2. ✅ 多用户场景互不影响
3. ✅ 前端无需改动即可正常工作

## 风险控制

### 回滚方案
如果出现问题，可以：
1. 暂时移除 `deletedUsers` 相关过滤条件
2. 恢复原来的纯物理删除逻辑
3. 清空 `deletedUsers` 字段恢复显示

### 性能考虑
- `addToSet` 和 `nin` 操作都是 O(n) 复杂度，对于正常用户量无性能问题
- 如果单条消息被大量用户删除，可考虑定期清理 `deletedUsers` 数组过长的记录

## 预期效果

✅ **上新通知**：用户删除后对自己隐藏，其他用户不受影响
✅ **取货提醒**：删除后彻底清除数据库记录
✅ **原有功能**：完全保留，前端无需任何改动
✅ **数据安全**：支持历史数据平滑过渡
