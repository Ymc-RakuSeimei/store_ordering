# AI助手大模型答案验证修复计划

## 问题分析

通过代码分析，发现AI助手在处理营业额查询时显示"数据不足"的原因：

1. **问题1：数据提取逻辑不完善**
   - `extractDataFacts` 函数只处理数组和对象类型的数据，没有处理字符串类型的数据
   - 当 `originalData` 是字符串时（例如 `answerDraft` 或 `contextSummary`），函数返回 `maxMoney: undefined`
   - 这导致数据验证逻辑无法正确处理字符串类型的原始数据

2. **问题2：数据验证逻辑错误**
   - 当 `originalData` 是字符串时，`extractDataFacts` 返回 `maxMoney: undefined`
   - 这可能导致大模型的回答被误判为编造

## 解决方案

### 1. 优化 `extractDataFacts` 函数
- 添加对字符串类型数据的处理逻辑
- 当 `originalData` 是字符串时，提取其中的金额数据
- 确保函数能够正确处理 `answerDraft` 或 `contextSummary` 格式的字符串

### 2. 优化 `correctFabricatedAnswer` 函数
- 确保函数能够正确处理 `maxMoney` 为 `undefined` 的情况
- 避免将真实数据误判为编造

## 实施步骤

1. **修改 `cloudfunctions/aiAssistant/logic.js` 文件**
   - 修改 `extractDataFacts` 函数，添加对字符串类型数据的处理
   - 确保函数能够从字符串中提取金额数据
   - 优化 `correctFabricatedAnswer` 函数，确保正确处理 `maxMoney` 为 `undefined` 的情况

2. **测试验证**
   - 测试"本周营业额"查询
   - 验证AI助手是否正确显示营业额数据，而不是"数据不足"

## 预期结果

1. 当询问"本周营业额"时，AI助手应正确显示实际的营业额数据："本周总营业额￥48.00，预估净利润￥16.00。"
2. 确保大模型答案验证逻辑正确处理字符串类型的原始数据，不将其误判为编造

## 风险评估

- **低风险**：修改仅限于优化数据提取和验证逻辑，不影响其他功能
- **兼容性**：保持与现有API和数据结构的兼容性
- **性能**：新增逻辑复杂度低，不会影响响应速度

## 技术要点

- 正确处理字符串类型的原始数据，提取其中的金额信息
- 优化数据验证逻辑，确保真实数据不被误判为编造
- 保持与现有功能的兼容性